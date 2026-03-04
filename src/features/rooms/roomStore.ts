import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Room, RoomMember, RoomPerms, MemberWithProfile } from '@/types'

interface RoomState {
    rooms: Room[]
    currentRoom: Room | null
    members: MemberWithProfile[]
    permissions: RoomPerms | null
    isLoading: boolean
    error: string | null

    // Actions
    fetchPublicRooms: () => Promise<void>
    createRoom: (data: {
        name: string
        description?: string
        type: Room['type']
        password?: string
        maxParticipants?: number
    }) => Promise<Room>
    joinRoom: (roomId: string, inviteToken?: string, password?: string) => Promise<void>
    leaveRoom: () => Promise<void>
    fetchRoomMembers: (roomId: string) => Promise<void>
    setCurrentRoom: (room: Room | null) => void
    kickMember: (roomId: string, userId: string) => Promise<void>
    updateMemberRole: (roomId: string, userId: string, role: RoomMember['role']) => Promise<void>
    toggleRoomLock: (roomId: string, locked: boolean) => Promise<void>
    endMeeting: (roomId: string) => Promise<void>
    deleteRoom: (roomId: string) => Promise<void>
}

/** Hash password with SHA-256 */
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const useRoomStore = create<RoomState>((set, get) => ({
    rooms: [],
    currentRoom: null,
    members: [],
    permissions: null,
    isLoading: false,
    error: null,

    fetchPublicRooms: async () => {
        set({ isLoading: true, error: null })
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .eq('type', 'public')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) {
                console.warn('fetchPublicRooms error:', error.message)
                // Don't throw — just show empty list
                set({ rooms: [] })
                return
            }
            set({ rooms: data || [] })
        } catch (err) {
            console.warn('fetchPublicRooms exception:', err)
            set({ rooms: [], error: null }) // silently fail, show empty
        } finally {
            set({ isLoading: false })
        }
    },

    createRoom: async ({ name, description, type, password, maxParticipants = 50 }) => {
        set({ isLoading: true, error: null })
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const passwordHash = password ? await hashPassword(password) : null

            // Create room
            const { data: roomData, error } = await supabase
                .from('rooms')
                .insert({
                    name,
                    description: description || null,
                    type,
                    password_hash: passwordHash,
                    host_id: user.id,
                    max_participants: maxParticipants,
                } as never)
                .select('*')
                .single()

            const room = roomData as unknown as Room

            if (error || !room) {
                console.error('Room insert error:', error)
                throw new Error(error?.message || 'Failed to create room')
            }

            // Create host room_member entry
            const { error: memberErr } = await supabase.from('room_members').insert({
                room_id: room.id,
                user_id: user.id,
                role: 'host',
            } as never)

            if (memberErr) {
                console.warn('Member insert error (non-fatal):', memberErr.message)
            }

            // Create default permissions
            const { error: permErr } = await supabase.from('room_permissions').insert({
                room_id: room.id,
            } as never)

            if (permErr) {
                console.warn('Permissions insert error (non-fatal):', permErr.message)
            }

            set(state => ({ rooms: [room, ...state.rooms] }))
            return room
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to create room'
            set({ error: msg })
            throw err
        } finally {
            set({ isLoading: false })
        }
    },

    joinRoom: async (roomId, _inviteToken, password) => {
        set({ isLoading: true, error: null })
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Fetch room
            const { data: roomData, error: roomErr } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .is('deleted_at', null)
                .maybeSingle()

            const room = roomData as unknown as Room | null
            if (roomErr || !room) throw new Error('Room not found')
            if (room.is_locked) throw new Error('Room is locked')

            // Validate password if needed
            if (room.type === 'password_protected' && room.password_hash) {
                if (!password) throw new Error('Password required')
                const inputHash = await hashPassword(password)
                if (inputHash !== room.password_hash) throw new Error('Incorrect password')
            }

            // Check member count
            const { count } = await supabase
                .from('room_members')
                .select('*', { count: 'exact', head: true })
                .eq('room_id', roomId)
                .is('left_at', null)

            if ((count ?? 0) >= room.max_participants) throw new Error('Room is full')

            // Upsert member
            await supabase.from('room_members').upsert({
                room_id: roomId,
                user_id: user.id,
                role: 'member',
                left_at: null,
            } as never, { onConflict: 'room_id,user_id' })

            // Fetch permissions
            const { data: perms } = await supabase
                .from('room_permissions')
                .select('*')
                .eq('room_id', roomId)
                .maybeSingle()

            set({ currentRoom: room, permissions: perms })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to join room'
            set({ error: msg })
            throw err
        } finally {
            set({ isLoading: false })
        }
    },

    leaveRoom: async () => {
        const { currentRoom } = get()
        if (!currentRoom) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase
            .from('room_members')
            .update({ left_at: new Date().toISOString() } as never)
            .match({ room_id: currentRoom.id, user_id: user.id })

        await supabase.from('raised_hands')
            .delete()
            .match({ room_id: currentRoom.id, user_id: user.id })

        set({ currentRoom: null, members: [], permissions: null })
    },

    fetchRoomMembers: async (roomId) => {
        const { data } = await supabase
            .from('room_members')
            .select('*, profile:profiles(*)')
            .eq('room_id', roomId)
            .is('left_at', null)

        if (data) {
            set({ members: data as unknown as MemberWithProfile[] })
        }
    },

    setCurrentRoom: (room) => set({ currentRoom: room }),

    kickMember: async (roomId, userId) => {
        await supabase
            .from('room_members')
            .update({ left_at: new Date().toISOString() } as never)
            .match({ room_id: roomId, user_id: userId })

        set(state => ({
            members: state.members.filter(m => m.user_id !== userId),
        }))
    },

    updateMemberRole: async (roomId, userId, role) => {
        await supabase
            .from('room_members')
            .update({ role } as never)
            .match({ room_id: roomId, user_id: userId })

        set(state => ({
            members: state.members.map(m =>
                m.user_id === userId ? { ...m, role } : m
            ),
        }))
    },

    toggleRoomLock: async (roomId, locked) => {
        await supabase.from('rooms').update({ is_locked: locked } as never).eq('id', roomId)
        set(state => ({
            currentRoom: state.currentRoom?.id === roomId
                ? { ...state.currentRoom, is_locked: locked }
                : state.currentRoom,
        }))
    },

    endMeeting: async (roomId) => {
        await supabase
            .from('room_members')
            .update({ left_at: new Date().toISOString() } as never)
            .eq('room_id', roomId)
            .is('left_at', null)

        await supabase.from('rooms').update({ deleted_at: new Date().toISOString() } as never).eq('id', roomId)
        set({ currentRoom: null, members: [], permissions: null })
    },

    deleteRoom: async (roomId) => {
        // Soft delete: mark all members as left, then soft-delete the room
        await supabase
            .from('room_members')
            .update({ left_at: new Date().toISOString() } as never)
            .eq('room_id', roomId)
            .is('left_at', null)

        await supabase.from('rooms')
            .update({ deleted_at: new Date().toISOString() } as never)
            .eq('id', roomId)

        set(state => ({
            rooms: state.rooms.filter(r => r.id !== roomId),
            currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
            members: state.currentRoom?.id === roomId ? [] : state.members,
            permissions: state.currentRoom?.id === roomId ? null : state.permissions,
        }))
    },
}))
