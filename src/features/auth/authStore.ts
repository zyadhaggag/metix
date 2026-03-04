import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
    session: Session | null
    user: User | null
    profile: Profile | null
    isLoading: boolean
    isInitialized: boolean

    // Actions
    setSession: (session: Session | null) => void
    setProfile: (profile: Profile | null) => void
    initialize: () => Promise<void>
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, username: string) => Promise<void>
    signInWithGoogle: () => Promise<void>
    signOut: () => Promise<void>
    updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'status'>>) => Promise<void>
    fetchProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            session: null,
            user: null,
            profile: null,
            isLoading: false,
            isInitialized: false,

            setSession: (session) => set({ session, user: session?.user ?? null }),
            setProfile: (profile) => set({ profile }),

            initialize: async () => {
                set({ isLoading: true })
                try {
                    const { data: { session } } = await supabase.auth.getSession()
                    set({ session, user: session?.user ?? null })

                    if (session?.user) {
                        await get().fetchProfile(session.user.id)
                    }

                    // Listen for auth state changes
                    supabase.auth.onAuthStateChange(async (_event, session) => {
                        set({ session, user: session?.user ?? null })
                        if (session?.user) {
                            await get().fetchProfile(session.user.id)
                        } else {
                            set({ profile: null })
                        }
                    })
                } finally {
                    set({ isLoading: false, isInitialized: true })
                }
            },

            signIn: async (email, password) => {
                set({ isLoading: true })
                try {
                    const { error } = await supabase.auth.signInWithPassword({ email, password })
                    if (error) throw error
                } finally {
                    set({ isLoading: false })
                }
            },

            signUp: async (email, password, username) => {
                set({ isLoading: true })
                try {
                    // Check username availability (maybeSingle = no error if 0 rows)
                    const { data: existing } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('username', username)
                        .maybeSingle()

                    if (existing) throw new Error('Username already taken')

                    const { error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: { data: { username } },
                    })
                    if (error) throw error
                } finally {
                    set({ isLoading: false })
                }
            },

            signInWithGoogle: async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                })
                if (error) throw error
            },

            signOut: async () => {
                try {
                    const { user } = get()
                    if (user) {
                        await supabase.from('profiles').update({ status: 'offline' } as never).eq('id', user.id)
                    }
                } catch { /* ignore if profile doesn't exist */ }
                await supabase.auth.signOut()
                set({ session: null, user: null, profile: null })
            },

            fetchProfile: async (userId: string) => {
                // Use maybeSingle to avoid 406 when profile doesn't exist yet
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle()

                if (data) {
                    set({ profile: data })
                    // Set user as online
                    await supabase.from('profiles').update({ status: 'online' } as never).eq('id', userId)
                } else {
                    // Profile doesn't exist yet — auto-create it from auth user metadata
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                        const username = user.user_metadata?.username || user.email?.split('@')[0] || `user_${userId.slice(0, 8)}`
                        const displayName = user.user_metadata?.full_name || username
                        const avatarUrl = user.user_metadata?.avatar_url || null

                        const { data: newProfile } = await supabase
                            .from('profiles')
                            .upsert({
                                id: userId,
                                username,
                                display_name: displayName,
                                avatar_url: avatarUrl,
                                status: 'online',
                            } as never, { onConflict: 'id' })
                            .select('*')
                            .single()

                        if (newProfile) {
                            set({ profile: newProfile })
                        }
                    }
                }
            },

            updateProfile: async (updates) => {
                const { user } = get()
                if (!user) throw new Error('Not authenticated')

                const { data, error } = await supabase
                    .from('profiles')
                    .update(updates as never)
                    .eq('id', user.id)
                    .select('*')
                    .single()

                if (error) throw error
                if (data) set({ profile: data })
            },
        }),
        {
            name: 'meetix-auth',
            partialize: (state) => ({ session: state.session }),
        }
    )
)
