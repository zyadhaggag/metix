import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { MessageWithProfile, Profile } from '@/types'
import DOMPurify from 'dompurify'

interface ChatState {
    messages: MessageWithProfile[]
    typingUsers: Record<string, { username: string; timestamp: number }>
    isLoading: boolean
    unreadCount: number

    fetchMessages: (roomId: string) => Promise<void>
    sendMessage: (roomId: string, userId: string, content: string, type?: 'text' | 'emoji' | 'file') => Promise<void>
    editMessage: (messageId: string, content: string) => Promise<void>
    deleteMessage: (messageId: string) => Promise<void>
    addMessage: (message: MessageWithProfile) => void
    removeMessage: (messageId: string) => void
    addReaction: (messageId: string, userId: string, emoji: string) => Promise<void>
    removeReaction: (messageId: string, userId: string, emoji: string) => Promise<void>
    setTyping: (userId: string, username: string, isTyping: boolean) => void
    clearUnread: () => void
    subscribeToRoom: (roomId: string) => () => void
}

const MESSAGE_RATE_LIMIT_MS = 500
let lastMessageTime = 0

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    typingUsers: {},
    isLoading: false,
    unreadCount: 0,

    fetchMessages: async (roomId) => {
        set({ isLoading: true })
        try {
            const { data } = await supabase
                .from('messages')
                .select('*, profile:profiles(*), reactions(*)')
                .eq('room_id', roomId)
                .is('deleted_at', null)
                .order('created_at', { ascending: true })
                .limit(100)

            set({ messages: (data as unknown as MessageWithProfile[]) || [] })
        } finally {
            set({ isLoading: false })
        }
    },

    sendMessage: async (roomId, userId, content, type = 'text') => {
        const now = Date.now()
        if (now - lastMessageTime < MESSAGE_RATE_LIMIT_MS) return
        lastMessageTime = now

        const sanitized = DOMPurify.sanitize(content.trim())
        if (!sanitized) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Optimistic addition
        const tempId = crypto.randomUUID()
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()

        const optimistic: MessageWithProfile = {
            id: tempId,
            room_id: roomId,
            user_id: userId,
            content: sanitized,
            type,
            file_url: null,
            is_edited: false,
            deleted_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            profile: profile as Profile,
            reactions: [],
        }
        set(state => ({ messages: [...state.messages, optimistic] }))

        const { data, error } = await supabase
            .from('messages')
            .insert({ room_id: roomId, user_id: userId, content: sanitized, type } as never)
            .select('*, profile:profiles(*), reactions(*)')
            .single()

        if (error) {
            set(state => ({ messages: state.messages.filter(m => m.id !== tempId) }))
            return
        }

        set(state => ({
            messages: state.messages.map(m => m.id === tempId ? (data as unknown as MessageWithProfile) : m),
        }))
    },

    editMessage: async (messageId, content) => {
        const sanitized = DOMPurify.sanitize(content.trim())
        if (!sanitized) return

        await supabase.from('messages')
            .update({ content: sanitized, is_edited: true })
            .eq('id', messageId)

        set(state => ({
            messages: state.messages.map(m =>
                m.id === messageId ? { ...m, content: sanitized, is_edited: true } : m
            ),
        }))
    },

    deleteMessage: async (messageId) => {
        // Soft delete
        await supabase.from('messages')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', messageId)

        set(state => ({ messages: state.messages.filter(m => m.id !== messageId) }))
    },

    addMessage: (message) => set(state => {
        // Prevent duplicate messages
        if (state.messages.some(m => m.id === message.id)) return state
        return {
            messages: [...state.messages, message],
            unreadCount: state.unreadCount + 1,
        }
    }),

    removeMessage: (messageId) => set(state => ({
        messages: state.messages.filter(m => m.id !== messageId),
    })),

    addReaction: async (messageId, userId, emoji) => {
        await supabase.from('reactions').upsert(
            { message_id: messageId, user_id: userId, emoji },
            { onConflict: 'message_id,user_id,emoji' }
        )
    },

    removeReaction: async (messageId, userId, emoji) => {
        await supabase.from('reactions')
            .delete()
            .match({ message_id: messageId, user_id: userId, emoji })
    },

    setTyping: (userId, username, isTyping) => {
        set(state => {
            if (!isTyping) {
                const { [userId]: _, ...rest } = state.typingUsers
                return { typingUsers: rest }
            }
            return {
                typingUsers: {
                    ...state.typingUsers,
                    [userId]: { username, timestamp: Date.now() },
                },
            }
        })
    },

    clearUnread: () => set({ unreadCount: 0 }),

    subscribeToRoom: (roomId) => {
        // Fetch initial messages
        get().fetchMessages(roomId)

        const channel = supabase
            .channel(`room-chat:${roomId}`)
            // New messages
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`,
            }, async (payload) => {
                const { data } = await supabase
                    .from('messages')
                    .select('*, profile:profiles(*), reactions(*)')
                    .eq('id', payload.new.id)
                    .single()

                if (data) {
                    const { data: { user } } = await supabase.auth.getUser()
                    // Don't re-add own messages (already added optimistically)
                    if (data.user_id !== user?.id) {
                        get().addMessage(data as unknown as MessageWithProfile)
                    }
                }
            })
            // Deleted messages (soft delete = UPDATE with deleted_at set)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`,
            }, (payload) => {
                const updated = payload.new as { id: string; deleted_at: string | null }
                if (updated.deleted_at) {
                    get().removeMessage(updated.id)
                }
            })
            // Typing indicators
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                get().setTyping(payload.userId, payload.username, payload.isTyping)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    },
}))
