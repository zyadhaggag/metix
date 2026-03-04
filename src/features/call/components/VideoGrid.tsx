import { Track } from 'livekit-client'
import { useTracks } from '@livekit/components-react'
import { VideoTile } from './VideoTile'

export function VideoGrid() {
    const tracks = useTracks([
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
    ], { onlySubscribed: false })

    // Separate screen shares from camera tracks
    const screenShares = tracks.filter(t => t.source === Track.Source.ScreenShare)
    const cameraTracks = tracks.filter(t => t.source !== Track.Source.ScreenShare)

    const hasScreenShare = screenShares.length > 0

    // When screen sharing: primary + secondary layout
    if (hasScreenShare) {
        return (
            <div className="vg-screenshare-layout">
                {/* Primary: screen share(s) */}
                <div className="vg-primary">
                    {screenShares.map((track) => (
                        <VideoTile
                            key={track.participant.identity + '_screen'}
                            trackRef={track}
                        />
                    ))}
                </div>
                {/* Secondary: camera feeds in a strip */}
                {cameraTracks.length > 0 && (
                    <div className="vg-secondary">
                        {cameraTracks.map((track) => (
                            <VideoTile
                                key={track.participant.identity + '_cam'}
                                trackRef={track}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Normal grid: auto-fit columns
    const total = cameraTracks.length
    const cols =
        total <= 1 ? 1 :
            total <= 2 ? 2 :
                total <= 4 ? 2 :
                    total <= 6 ? 3 :
                        total <= 9 ? 3 : 4

    return (
        <div
            className="vg-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
            {cameraTracks.map((track) => (
                <VideoTile
                    key={track.participant.identity + '_' + track.source}
                    trackRef={track}
                />
            ))}
        </div>
    )
}
