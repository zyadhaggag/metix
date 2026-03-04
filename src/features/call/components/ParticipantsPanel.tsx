import { useState } from 'react'
import { Crown, Shield, MicOff, VideoOff, Hand, X, MessageSquare, MoreVertical } from 'lucide-react'
import { useRoomStore } from '@/features/rooms/roomStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useParticipants } from '@livekit/components-react'

interface ParticipantsPanelProps {
    roomId: string
    onClose?: () => void
    onPrivateMessage?: (userId: string) => void
}

export function ParticipantsPanel({ roomId, onClose, onPrivateMessage }: ParticipantsPanelProps) {
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
    const { members, currentRoom, kickMember, updateMemberRole } = useRoomStore()
    const { user } = useAuthStore()
    const livekitParticipants = useParticipants()

    const isHost = currentRoom?.host_id === user?.id
    const myMember = members.find(m => m.user_id === user?.id)
    const isModerator = myMember?.role === 'moderator' || isHost

    const ranked = [...members].sort((a, b) => {
        const rank = (r: string) => r === 'host' ? 0 : r === 'moderator' ? 1 : 2
        return rank(a.role) - rank(b.role)
    })

    const handleForceMute = async (targetUserId: string) => {
        if (!currentRoom) return
        try {
            await fetch(`${import.meta.env.VITE_TOKEN_SERVER_URL}/api/livekit/mute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: currentRoom.id, targetIdentity: targetUserId })
            })
        } catch (e) { console.error('Failed to mute', e) }
        setMenuOpenFor(null)
    }

    const handleKick = async (targetUserId: string) => {
        if (!currentRoom) return
        await kickMember(currentRoom.id, targetUserId)
        try {
            await fetch(`${import.meta.env.VITE_TOKEN_SERVER_URL}/api/livekit/kick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: currentRoom.id, targetIdentity: targetUserId })
            })
        } catch (e) { console.error('Failed to kick', e) }
        setMenuOpenFor(null)
    }

    const handlePromote = async (targetUserId: string, toRole: 'moderator' | 'member') => {
        if (!currentRoom) return
        await updateMemberRole(currentRoom.id, targetUserId, toRole)
        setMenuOpenFor(null)
    }

    return (
        <div className="panel-container">
            {/* Header */}
            <div className="panel-header">
                <h3 className="panel-title">
                    Participants <span className="panel-count">({members.length})</span>
                </h3>
                {onClose && (
                    <button className="panel-close-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Member list */}
            <div className="panel-list">
                {ranked.map(member => {
                    const name = member.profile?.display_name || member.profile?.username || 'Unknown'
                    const isMe = member.user_id === user?.id
                    const isThisHost = member.role === 'host'
                    const isThisMod = member.role === 'moderator'
                    const canModerate = isModerator && !isMe && !isThisHost

                    const lkParticipant = livekitParticipants.find(p => p.identity === member.user_id)
                    const isMuted = lkParticipant ? !lkParticipant.isMicrophoneEnabled : true
                    const camEnabled = lkParticipant ? lkParticipant.isCameraEnabled : false
                    const isOnline = !!lkParticipant

                    return (
                        <div key={member.id} className="participant-row">
                            {/* Avatar */}
                            <div className="participant-avatar-wrap">
                                <div className="participant-avatar">
                                    {member.profile?.avatar_url
                                        ? <img src={member.profile.avatar_url} alt="" className="participant-avatar-img" />
                                        : name[0]?.toUpperCase()}
                                </div>
                                {isOnline && <div className="participant-online-dot" />}
                            </div>

                            {/* Name + role */}
                            <div className="participant-info">
                                <div className="participant-name-row">
                                    <span className="participant-name">{name}</span>
                                    {isMe && <span className="participant-you">(You)</span>}
                                    {isThisHost && <Crown size={12} color="#f59e0b" />}
                                    {isThisMod && <Shield size={12} color="#7c3aed" />}
                                </div>
                                <div className="participant-role-row">
                                    <span className="participant-role">
                                        {isThisHost ? 'Host' : isThisMod ? 'Moderator' : 'Member'}
                                    </span>
                                    {member.hand_raised && (
                                        <span className="participant-hand">✋ Raised</span>
                                    )}
                                </div>
                            </div>

                            {/* Status icons */}
                            <div className="participant-status">
                                {isMuted && <MicOff size={13} color="#ef4444" />}
                                {!camEnabled && <VideoOff size={13} color="#ef4444" />}
                                {member.hand_raised && <Hand size={13} color="#f59e0b" />}
                            </div>

                            {/* Moderation */}
                            {(canModerate || (onPrivateMessage && !isMe)) && (
                                <div className="participant-actions">
                                    {onPrivateMessage && !isMe && (
                                        <button className="participant-action-btn" onClick={() => onPrivateMessage(member.user_id)}>
                                            <MessageSquare size={14} />
                                        </button>
                                    )}
                                    {canModerate && (
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                className="participant-action-btn"
                                                onClick={() => setMenuOpenFor(menuOpenFor === member.user_id ? null : member.user_id)}>
                                                <MoreVertical size={14} />
                                            </button>
                                            {menuOpenFor === member.user_id && (
                                                <div className="participant-menu">
                                                    <button className="participant-menu-item" onClick={() => handleForceMute(member.user_id)}>
                                                        Force Mute
                                                    </button>
                                                    {isHost && (
                                                        <button className="participant-menu-item" onClick={() => handlePromote(member.user_id, isThisMod ? 'member' : 'moderator')}>
                                                            {isThisMod ? 'Remove Mod' : 'Make Moderator'}
                                                        </button>
                                                    )}
                                                    <button className="participant-menu-item participant-menu-danger" onClick={() => handleKick(member.user_id)}>
                                                        Kick from Room
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
