import { useCallback } from 'react'
import {
    Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
    Hand, MessageSquare, Users, PhoneOff, LogOut, Lock, Unlock,
} from 'lucide-react'
import { useLocalParticipant, useParticipants } from '@livekit/components-react'
import { useRoomStore } from '@/features/rooms/roomStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useLiveKitStore } from '@/store/livekitStore'

interface ControlBarProps {
    onRaiseHand: () => void
    onLeave: () => void
    handRaised: boolean
}

export function ControlBar({ onRaiseHand, onLeave, handRaised }: ControlBarProps) {
    // useLocalParticipant is REACTIVE — re-renders on track state changes
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()
    const allParticipants = useParticipants()

    const { currentRoom, toggleRoomLock, endMeeting, members } = useRoomStore()
    const { user } = useAuthStore()
    const { showChat, showParticipants, toggleChat, toggleParticipants, unreadChatCount } = useLiveKitStore()

    const isHost = currentRoom?.host_id === user?.id
    const myMember = members.find(p => p.user_id === user?.id)
    const isModerator = myMember?.role === 'moderator' || isHost

    const onToggleMute = useCallback(async () => {
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    }, [isMicrophoneEnabled, localParticipant])

    const onToggleCamera = useCallback(async () => {
        await localParticipant.setCameraEnabled(!isCameraEnabled)
    }, [isCameraEnabled, localParticipant])

    const onToggleScreenShare = useCallback(async () => {
        await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    }, [isScreenShareEnabled, localParticipant])

    return (
        <div className="controlbar-wrapper">
            <div className="controlbar-pill">
                {/* Mic */}
                <button className={`cb-btn ${!isMicrophoneEnabled ? 'cb-btn-danger' : ''}`} onClick={onToggleMute}>
                    {!isMicrophoneEnabled ? <MicOff size={20} /> : <Mic size={20} />}
                    <span>{!isMicrophoneEnabled ? 'Unmute' : 'Mute'}</span>
                </button>

                {/* Camera */}
                <button className={`cb-btn ${!isCameraEnabled ? 'cb-btn-danger' : ''}`} onClick={onToggleCamera}>
                    {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                    <span>Camera</span>
                </button>

                {/* Screen Share */}
                <button className={`cb-btn ${isScreenShareEnabled ? 'cb-btn-accent' : ''}`} onClick={onToggleScreenShare}>
                    {isScreenShareEnabled ? <MonitorOff size={20} /> : <Monitor size={20} />}
                    <span className="cb-label-hide-mobile">Share</span>
                </button>

                {/* Raise Hand */}
                <button className={`cb-btn ${handRaised ? 'cb-btn-warn' : ''}`} onClick={onRaiseHand}>
                    <Hand size={20} />
                    <span className="cb-label-hide-mobile">Hand</span>
                </button>

                <div className="cb-divider" />

                {/* Chat */}
                <button className={`cb-btn ${showChat ? 'cb-btn-accent' : ''}`} onClick={toggleChat}>
                    <MessageSquare size={20} />
                    <span className="cb-label-hide-mobile">Chat</span>
                    {unreadChatCount > 0 && (
                        <div className="cb-badge">{unreadChatCount > 9 ? '9+' : unreadChatCount}</div>
                    )}
                </button>

                {/* Participants */}
                <button className={`cb-btn ${showParticipants ? 'cb-btn-accent' : ''}`} onClick={toggleParticipants}>
                    <Users size={20} />
                    <span className="cb-label-hide-mobile">People</span>
                    <div className="cb-badge-count">{allParticipants.length}</div>
                </button>

                {/* Host: Lock */}
                {isModerator && currentRoom && (
                    <>
                        <div className="cb-divider" />
                        <button
                            className={`cb-btn ${currentRoom.is_locked ? 'cb-btn-warn' : ''}`}
                            onClick={() => toggleRoomLock(currentRoom.id, !currentRoom.is_locked)}>
                            {currentRoom.is_locked ? <Lock size={20} /> : <Unlock size={20} />}
                            <span className="cb-label-hide-mobile">{currentRoom.is_locked ? 'Locked' : 'Lock'}</span>
                        </button>
                    </>
                )}

                <div className="cb-divider" />

                {/* Leave / End */}
                {isHost ? (
                    <button className="cb-btn cb-btn-end" onClick={() => { if (currentRoom) endMeeting(currentRoom.id) }}>
                        <PhoneOff size={20} />
                        <span>End</span>
                    </button>
                ) : (
                    <button className="cb-btn cb-btn-leave" onClick={onLeave}>
                        <LogOut size={20} />
                        <span>Leave</span>
                    </button>
                )}
            </div>
        </div>
    )
}
