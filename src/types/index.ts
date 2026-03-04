// ============================================================
// Meetix App-Level Types
// ============================================================

import type { Database } from './database.types'

// DB Row Aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomMember = Database['public']['Tables']['room_members']['Row']
export type RoomPerms = Database['public']['Tables']['room_permissions']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Reaction = Database['public']['Tables']['reactions']['Row']
export type PrivateConv = Database['public']['Tables']['private_conversations']['Row']
export type PrivateMsg = Database['public']['Tables']['private_messages']['Row']
export type RaisedHand = Database['public']['Tables']['raised_hands']['Row']
export type Recording = Database['public']['Tables']['recordings']['Row']

// ---- Enriched types ----
export interface MemberWithProfile extends RoomMember {
    profile: Profile
    isSpeaking?: boolean
    stream?: MediaStream | null
}

export interface MessageWithProfile extends Message {
    profile: Profile
    reactions: Reaction[]
}

// ---- Participant presence ----
export interface PresenceState {
    userId: string
    username: string
    avatarUrl: string | null
    status: Profile['status']
    joinedAt: string
}

// ---- Signaling events ----
export type SignalEvent =
    | { type: 'user-join'; payload: { userId: string; peerId: string } }
    | { type: 'offer'; payload: { to: string; from: string; signal: unknown } }
    | { type: 'answer'; payload: { to: string; from: string; signal: unknown } }
    | { type: 'ice-candidate'; payload: { to: string; from: string; candidate: RTCIceCandidateInit } }
    | { type: 'user-leave'; payload: { userId: string } }
    | { type: 'mic-update'; payload: { userId: string; muted: boolean } }
    | { type: 'cam-update'; payload: { userId: string; enabled: boolean } }
    | { type: 'screen-share'; payload: { userId: string; sharing: boolean } }
    | { type: 'force-mute'; payload: { targetUserId: string } }
    | { type: 'host-action'; payload: { action: 'kick' | 'lock-room' | 'end-meeting'; targetUserId?: string } }

// ---- Device info ----
export interface DeviceInfo {
    deviceId: string
    label: string
    kind: MediaDeviceKind
}

// ---- Network quality ----
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
