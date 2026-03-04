import { MicOff, VideoOff, Monitor } from 'lucide-react'
import { Track } from 'livekit-client'
import { VideoTrack, useIsSpeaking } from '@livekit/components-react'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { useRoomStore } from '@/features/rooms/roomStore'

interface VideoTileProps {
    trackRef: TrackReferenceOrPlaceholder
}

export function VideoTile({ trackRef }: VideoTileProps) {
    const participant = trackRef.participant
    const isSpeaking = useIsSpeaking(participant)
    const { members } = useRoomStore()

    const member = members.find(m => m.user_id === participant.identity)

    const name = member?.profile?.display_name || member?.profile?.username || participant.name || 'Unknown'
    const initial = name[0]?.toUpperCase() || '?'

    const isMuted = !participant.isMicrophoneEnabled
    const camEnabled = participant.isCameraEnabled
    const isScreenShare = trackRef.source === Track.Source.ScreenShare

    // Determine if we have an actual video track to render
    const isPlaceholder = !trackRef.publication
    const hasVideo = !isPlaceholder && !!trackRef.publication?.track

    return (
        <div className={`video-tile ${isSpeaking ? 'video-tile-speaking' : ''}`}>
            {/* Video or Avatar */}
            {hasVideo ? (
                <VideoTrack
                    trackRef={trackRef}
                    style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        transform: participant.isLocal && !isScreenShare ? 'scaleX(-1)' : 'none',
                    }}
                />
            ) : (
                <div className="video-tile-avatar-wrap">
                    <div className="video-tile-avatar">
                        {member?.profile?.avatar_url
                            ? <img src={member.profile.avatar_url} alt={name} className="video-tile-avatar-img" />
                            : initial}
                    </div>
                </div>
            )}

            {/* Screen share badge */}
            {isScreenShare && (
                <div className="video-tile-screen-badge">
                    <Monitor size={12} /> Screen
                </div>
            )}

            {/* Bottom info */}
            <div className="video-tile-info">
                <span className="video-tile-name">
                    {name}{participant.isLocal ? ' (You)' : ''}
                </span>
                <div className="video-tile-icons">
                    {isMuted && <MicOff size={12} color="#ef4444" />}
                    {!camEnabled && !isScreenShare && <VideoOff size={12} color="#ef4444" />}
                    {isSpeaking && !isMuted && <div className="video-tile-speaking-dot" />}
                </div>
            </div>
        </div>
    )
}
