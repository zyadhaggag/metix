// ============================================================
// Meetix — Full TypeScript types matching the DB schema
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    username: string
                    display_name: string | null
                    avatar_url: string | null
                    bio: string | null
                    status: 'online' | 'away' | 'busy' | 'offline'
                    created_at: string
                    updated_at: string
                    deleted_at: string | null
                }
                Insert: {
                    id: string
                    username: string
                    display_name?: string | null
                    avatar_url?: string | null
                    bio?: string | null
                    status?: 'online' | 'away' | 'busy' | 'offline'
                    created_at?: string
                    updated_at?: string
                    deleted_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>
            }
            rooms: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    type: 'public' | 'private' | 'password_protected'
                    password_hash: string | null
                    invite_token: string
                    host_id: string
                    is_locked: boolean
                    max_participants: number
                    created_at: string
                    updated_at: string
                    deleted_at: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    type?: 'public' | 'private' | 'password_protected'
                    password_hash?: string | null
                    invite_token?: string
                    host_id: string
                    is_locked?: boolean
                    max_participants?: number
                }
                Update: Partial<Database['public']['Tables']['rooms']['Insert']>
            }
            room_members: {
                Row: {
                    id: string
                    room_id: string
                    user_id: string
                    role: 'host' | 'moderator' | 'member'
                    is_muted: boolean
                    cam_enabled: boolean
                    hand_raised: boolean
                    joined_at: string
                    left_at: string | null
                }
                Insert: {
                    id?: string
                    room_id: string
                    user_id: string
                    role?: 'host' | 'moderator' | 'member'
                    is_muted?: boolean
                    cam_enabled?: boolean
                    hand_raised?: boolean
                }
                Update: Partial<Database['public']['Tables']['room_members']['Insert']>
            }
            room_permissions: {
                Row: {
                    id: string
                    room_id: string
                    allow_mic: boolean
                    allow_camera: boolean
                    allow_screen_share: boolean
                    allow_chat: boolean
                    allow_raise_hand: boolean
                    updated_at: string
                }
                Insert: {
                    id?: string
                    room_id: string
                    allow_mic?: boolean
                    allow_camera?: boolean
                    allow_screen_share?: boolean
                    allow_chat?: boolean
                    allow_raise_hand?: boolean
                }
                Update: Partial<Database['public']['Tables']['room_permissions']['Insert']>
            }
            call_sessions: {
                Row: {
                    id: string
                    room_id: string
                    started_at: string
                    ended_at: string | null
                    peak_count: number
                }
                Insert: { id?: string; room_id: string; peak_count?: number }
                Update: Partial<Database['public']['Tables']['call_sessions']['Insert']>
            }
            messages: {
                Row: {
                    id: string
                    room_id: string
                    user_id: string
                    content: string
                    type: 'text' | 'emoji' | 'file' | 'system'
                    file_url: string | null
                    is_edited: boolean
                    deleted_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    room_id: string
                    user_id: string
                    content: string
                    type?: 'text' | 'emoji' | 'file' | 'system'
                    file_url?: string | null
                }
                Update: Partial<Database['public']['Tables']['messages']['Insert']>
            }
            reactions: {
                Row: {
                    id: string
                    message_id: string
                    user_id: string
                    emoji: string
                    created_at: string
                }
                Insert: { id?: string; message_id: string; user_id: string; emoji: string }
                Update: Partial<Database['public']['Tables']['reactions']['Insert']>
            }
            private_conversations: {
                Row: {
                    id: string
                    user_a_id: string
                    user_b_id: string
                    created_at: string
                    updated_at: string
                }
                Insert: { id?: string; user_a_id: string; user_b_id: string }
                Update: Partial<Database['public']['Tables']['private_conversations']['Insert']>
            }
            private_messages: {
                Row: {
                    id: string
                    conversation_id: string
                    sender_id: string
                    content: string
                    type: 'text' | 'emoji' | 'file'
                    file_url: string | null
                    is_read: boolean
                    is_edited: boolean
                    deleted_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    conversation_id: string
                    sender_id: string
                    content: string
                    type?: 'text' | 'emoji' | 'file'
                    file_url?: string | null
                }
                Update: Partial<Database['public']['Tables']['private_messages']['Insert']>
            }
            raised_hands: {
                Row: {
                    id: string
                    room_id: string
                    user_id: string
                    raised_at: string
                }
                Insert: { id?: string; room_id: string; user_id: string }
                Update: never
            }
            recordings: {
                Row: {
                    id: string
                    room_id: string
                    session_id: string | null
                    started_by: string
                    storage_path: string | null
                    status: 'pending' | 'recording' | 'processing' | 'ready' | 'failed'
                    duration_ms: number | null
                    size_bytes: number | null
                    created_at: string
                    ended_at: string | null
                }
                Insert: {
                    id?: string
                    room_id: string
                    session_id?: string | null
                    started_by: string
                    status?: 'pending' | 'recording' | 'processing' | 'ready' | 'failed'
                }
                Update: Partial<Database['public']['Tables']['recordings']['Insert']>
            }
        }
        Views: Record<string, never>
        Functions: Record<string, never>
        Enums: Record<string, never>
    }
}
