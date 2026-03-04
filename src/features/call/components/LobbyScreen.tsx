import { useState, useCallback } from 'react'
import { Video, Mic, Monitor, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'

interface LobbyScreenProps {
    roomName: string
    onJoin: () => void | Promise<void>
    isLoading?: boolean
}

export function LobbyScreen({ roomName, onJoin, isLoading = false }: LobbyScreenProps) {
    const [videoPreview, setVideoPreview] = useState<MediaStream | null>(null)
    const [micReady, setMicReady] = useState(false)
    const [permissionError, setPermissionError] = useState<string | null>(null)
    const { profile } = useAuthStore()

    const handlePreview = useCallback(async () => {
        setPermissionError(null)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            setVideoPreview(stream)
            setMicReady(stream.getAudioTracks().length > 0)
        } catch (err: unknown) {
            setPermissionError(err instanceof Error ? err.message : 'Camera/mic permission denied')
        }
    }, [])

    const cardStyle: React.CSSProperties = {
        borderRadius: 20,
        background: 'rgba(18,18,28,0.7)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, fontFamily: "'Inter', system-ui, sans-serif",
            background: 'radial-gradient(ellipse at 50% 20%, rgba(124,58,237,0.12) 0%, #0a0a0f 60%)',
        }}>
            <div style={{ width: '100%', maxWidth: 740 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '6px 20px', borderRadius: 999, marginBottom: 16, fontSize: 13,
                        background: 'rgba(124,58,237,0.12)', color: '#a855f7',
                        border: '1px solid rgba(124,58,237,0.2)',
                    }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 1.5s infinite' }} />
                        Ready to join
                    </div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, color: '#f0f0f8', margin: '0 0 8px' }}>{roomName}</h1>
                    <p style={{ fontSize: 14, color: '#8b8ba8', margin: 0 }}>Check your camera and microphone before joining</p>
                </div>

                {/* Two column layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Camera preview */}
                    <div style={{ ...cardStyle, aspectRatio: '16/10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {videoPreview ? (
                            <video autoPlay muted playsInline
                                ref={el => { if (el) el.srcObject = videoPreview }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 32, fontWeight: 700, color: '#fff',
                                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                    overflow: 'hidden',
                                }}>
                                    {profile?.avatar_url
                                        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : profile?.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <button onClick={handlePreview} style={{
                                    padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                    background: 'rgba(124,58,237,0.15)', color: '#a855f7',
                                    border: '1px solid rgba(124,58,237,0.25)',
                                }}>Test Camera</button>
                            </div>
                        )}
                    </div>

                    {/* Device check panel */}
                    <div style={{ ...cardStyle, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f8', margin: 0 }}>Device Check</h3>

                        {permissionError && (
                            <div style={{
                                padding: '10px 14px', borderRadius: 12, fontSize: 12,
                                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                border: '1px solid rgba(239,68,68,0.15)',
                            }}>{permissionError}</div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { icon: Mic, label: 'Microphone', ready: micReady },
                                { icon: Video, label: 'Camera', ready: !!videoPreview },
                                { icon: Monitor, label: 'Screen Share', ready: true },
                            ].map(({ icon: Icon, label, ready }) => (
                                <div key={label} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px', borderRadius: 12,
                                    background: 'rgba(255,255,255,0.03)',
                                }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: ready ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                                    }}>
                                        <Icon size={16} color={ready ? '#22c55e' : '#4a4a6a'} />
                                    </div>
                                    <span style={{ fontSize: 13, color: '#f0f0f8', flex: 1 }}>{label}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ready ? '#22c55e' : '#4a4a6a' }} />
                                        <span style={{ fontSize: 11, color: ready ? '#22c55e' : '#5a5a7a' }}>{ready ? 'Ready' : 'Not tested'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p style={{ fontSize: 12, color: '#4a4a6a', marginTop: 'auto', margin: 0 }}>
                            Joining as <span style={{ color: '#a855f7', fontWeight: 500 }}>{profile?.display_name || profile?.username}</span>
                        </p>

                        <button onClick={onJoin} disabled={isLoading} style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 600,
                            color: '#fff', border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                            opacity: isLoading ? 0.6 : 1,
                        }}>
                            {isLoading ? 'Joining...' : <>Join Now <ArrowRight size={16} /></>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
