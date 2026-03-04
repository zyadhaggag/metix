import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

import { VideoGrid } from './VideoGrid'
import { ControlBar } from './ControlBar'
import { ParticipantsPanel } from './ParticipantsPanel'
import { ChatPanel } from '@/features/chat/ChatPanel'

import { useLiveKitStore } from '@/store/livekitStore'
import { useRoomStore } from '@/features/rooms/roomStore'
import { useAuthStore } from '@/features/auth/authStore'
import { supabase } from '@/lib/supabase'

interface CallRoomProps {
    roomId: string
    token: string
}

export function CallRoom({ roomId, token }: CallRoomProps) {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { currentRoom, members, fetchRoomMembers, leaveRoom } = useRoomStore()
    const { showChat, showParticipants, toggleChat, toggleParticipants, resetSession } = useLiveKitStore()
    const [handRaised, setHandRaised] = useState(false)
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

    // Sync Supabase room members
    useEffect(() => {
        fetchRoomMembers(roomId)
        const channel = supabase
            .channel(`room-members:${roomId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'room_members',
                filter: `room_id=eq.${roomId}`,
            }, () => { fetchRoomMembers(roomId) })
            .subscribe()
        channelRef.current = channel
        return () => {
            supabase.removeChannel(channel)
            channelRef.current = null
        }
    }, [roomId, fetchRoomMembers])

    // Full cleanup on leave
    const handleLeave = useCallback(async () => {
        // 1. Clear UI state
        resetSession()
        // 2. Remove from Supabase room_members
        await leaveRoom()
        // 3. Clean up realtime channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }
        // 4. Navigate away (LiveKitRoom disconnect handled by unmount)
        navigate('/')
    }, [leaveRoom, navigate, resetSession])

    const handleRaiseHand = useCallback(async () => {
        if (!user) return
        if (handRaised) {
            await supabase.from('raised_hands').delete().match({ room_id: roomId, user_id: user.id })
        } else {
            await supabase.from('raised_hands').upsert({ room_id: roomId, user_id: user.id } as never)
        }
        setHandRaised(h => !h)
    }, [handRaised, roomId, user])

    const showSide = showChat || showParticipants

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={import.meta.env.VITE_LIVEKIT_URL}
            onDisconnected={handleLeave}
            connectOptions={{ autoSubscribe: true }}
            options={{ adaptiveStream: true, dynacast: true }}
            className="call-room"
        >
            <RoomAudioRenderer />

            {/* Main content area */}
            <div className="call-main">
                {/* Header */}
                <div className="call-header">
                    <div className="call-header-left">
                        <div className="call-live-dot" />
                        <span className="call-room-name">{currentRoom?.name}</span>
                    </div>
                    <span className="call-participant-count">
                        {members.length} participant{members.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Video grid */}
                <div className="call-grid-container">
                    <VideoGrid />
                </div>

                {/* Controls */}
                <ControlBar
                    onRaiseHand={handleRaiseHand}
                    onLeave={handleLeave}
                    handRaised={handRaised}
                />
            </div>

            {/* Side panel overlay */}
            {showSide && (
                <>
                    <div className="call-overlay-backdrop" onClick={() => {
                        if (showChat) toggleChat()
                        if (showParticipants) toggleParticipants()
                    }} />
                    <div className="call-side-panel">
                        {showChat && <ChatPanel roomId={roomId} onClose={toggleChat} />}
                        {showParticipants && <ParticipantsPanel onClose={toggleParticipants} roomId={roomId} />}
                    </div>
                </>
            )}
        </LiveKitRoom>
    )
}
