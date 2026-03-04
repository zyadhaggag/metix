import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, Lock, Globe, Video, ChevronDown, LogOut, Settings, User } from 'lucide-react'
import { useRoomStore } from './roomStore'
import { useAuthStore } from '@/features/auth/authStore'
import type { Room } from '@/types'

export default function RoomsPage() {
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const [creating, setCreating] = useState(false)
    const [formData, setFormData] = useState({ name: '', description: '', type: 'public' as Room['type'], password: '' })
    const profileRef = useRef<HTMLDivElement>(null)

    const { rooms, fetchPublicRooms, createRoom, joinRoom, isLoading, error } = useRoomStore()
    const { profile, signOut } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => { fetchPublicRooms() }, [fetchPublicRooms])

    // Close profile dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filtered = rooms.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase())
    )

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        try {
            const room = await createRoom({
                name: formData.name,
                description: formData.description || undefined,
                type: formData.type,
                password: formData.type === 'password_protected' ? formData.password : undefined,
            })
            setShowCreate(false)
            setFormData({ name: '', description: '', type: 'public', password: '' })
            navigate(`/room/${room.id}`)
        } catch { /* handled in store */ }
        finally { setCreating(false) }
    }

    const handleJoin = async (roomId: string) => {
        try {
            await joinRoom(roomId)
            navigate(`/room/${roomId}`)
        } catch { /* handled in store */ }
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/auth/login')
    }

    const avatarInitial = (profile?.display_name || profile?.username || '?')[0].toUpperCase()

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: "'Inter', system-ui, sans-serif", color: '#f0f0f8' }}>

            {/* ─── Top Navigation Bar ─── */}
            <nav style={{
                position: 'sticky', top: 0, zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 28px',
                background: 'rgba(10,10,15,0.92)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                {/* Left: Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    }}>
                        <Video size={18} color="#fff" />
                    </div>
                    <span className="text-gradient" style={{ fontSize: 20, fontWeight: 700 }}>Meetix</span>
                </div>

                {/* Center: Search */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', borderRadius: 12, width: 320,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <Search size={14} color="#5a5a7a" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search rooms..."
                        style={{
                            background: 'transparent', border: 'none', outline: 'none',
                            color: '#f0f0f8', fontSize: 13, width: '100%',
                        }}
                    />
                </div>

                {/* Right: New Room + Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setShowCreate(true)} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 12,
                        fontSize: 13, fontWeight: 600, color: '#fff',
                        background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                    }}>
                        <Plus size={16} /> New Room
                    </button>

                    {/* Profile dropdown */}
                    <div ref={profileRef} style={{ position: 'relative' }}>
                        <button onClick={() => setShowProfile(p => !p)} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 12px 6px 6px', borderRadius: 12,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer', color: '#f0f0f8',
                        }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, color: '#fff',
                                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                overflow: 'hidden',
                            }}>
                                {profile?.avatar_url
                                    ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : avatarInitial}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {profile?.display_name || profile?.username}
                            </span>
                            <ChevronDown size={14} color="#8b8ba8" />
                        </button>

                        {showProfile && (
                            <div style={{
                                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                                minWidth: 200, borderRadius: 16, padding: '8px',
                                background: 'rgba(18,18,28,0.95)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                            }}>
                                {/* User info */}
                                <div style={{ padding: '12px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f8', margin: 0 }}>
                                        {profile?.display_name || profile?.username}
                                    </p>
                                    <p style={{ fontSize: 12, color: '#6b6b8a', margin: '4px 0 0' }}>
                                        @{profile?.username}
                                    </p>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        marginTop: 8, padding: '4px 10px', borderRadius: 20,
                                        background: 'rgba(34,197,94,0.1)', fontSize: 11, color: '#22c55e',
                                    }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                                        Online
                                    </div>
                                </div>

                                {/* Menu items */}
                                <div style={{ padding: '4px 0' }}>
                                    <button style={{
                                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                        padding: '10px 12px', borderRadius: 10, fontSize: 13,
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#c0c0d8',
                                        textAlign: 'left',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                        <User size={15} /> Profile
                                    </button>
                                    <button style={{
                                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                        padding: '10px 12px', borderRadius: 10, fontSize: 13,
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#c0c0d8',
                                        textAlign: 'left',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                        <Settings size={15} /> Settings
                                    </button>
                                </div>

                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '4px 0 0' }}>
                                    <button onClick={handleLogout} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                        padding: '10px 12px', borderRadius: 10, fontSize: 13,
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
                                        textAlign: 'left',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                        <LogOut size={15} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* ─── Hero ─── */}
            <div style={{
                padding: '64px 28px 48px',
                textAlign: 'center',
                background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.1) 0%, transparent 60%)',
            }}>
                <h1 className="text-gradient" style={{ fontSize: 42, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Meetix</h1>
                <p style={{ fontSize: 16, color: '#6b6b8a', marginTop: 12 }}>Professional meetings, reimagined.</p>
            </div>

            {/* ─── Room Grid ─── */}
            <div style={{ padding: '0 28px 64px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                        Public Rooms <span style={{ color: '#6b6b8a', fontSize: 14, fontWeight: 400 }}>({filtered.length})</span>
                    </h2>
                </div>

                {/* Error banner */}
                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 12, marginBottom: 20,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                        color: '#f87171', fontSize: 13,
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {isLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                        {[...Array(6)].map((_, i) => (
                            <div key={i} style={{
                                height: 140, borderRadius: 20,
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                            }} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                        <Users size={48} color="#3a3a5a" style={{ margin: '0 auto 16px' }} />
                        <p style={{ fontSize: 16, fontWeight: 500, color: '#6b6b8a', margin: '0 0 6px' }}>No rooms found</p>
                        <p style={{ fontSize: 13, color: '#4a4a6a', margin: 0 }}>Be the first to create one!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                        {filtered.map(room => (
                            <div key={room.id} onClick={() => handleJoin(room.id)}
                                style={{
                                    padding: '24px', borderRadius: 20, cursor: 'pointer',
                                    background: 'rgba(18,18,28,0.6)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    transition: 'all 0.2s',
                                    display: 'flex', flexDirection: 'column', gap: 12,
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.3)'
                                        ; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                                        ; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(124,58,237,0.1)'
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
                                        ; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                                        ; (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                                }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</h3>
                                        {room.description && (
                                            <p style={{ fontSize: 12, color: '#6b6b8a', margin: '6px 0 0', lineHeight: 1.5 }}>{room.description}</p>
                                        )}
                                    </div>
                                    <div style={{ marginLeft: 12, flexShrink: 0 }}>
                                        {room.type === 'public'
                                            ? <Globe size={16} color="#22c55e" />
                                            : <Lock size={16} color="#f59e0b" />}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b6b8a' }}>
                                        <Users size={13} />
                                        <span>0 / {room.max_participants}</span>
                                    </div>
                                    {room.is_locked && (
                                        <span style={{
                                            fontSize: 11, padding: '3px 10px', borderRadius: 20,
                                            background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                                            border: '1px solid rgba(245,158,11,0.2)',
                                        }}>Locked</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Create Room Modal ─── */}
            {showCreate && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                }}
                    onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
                    <div style={{
                        width: '100%', maxWidth: 440, borderRadius: 24, padding: '32px',
                        background: 'rgba(18,18,28,0.95)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
                    }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 28px', color: '#f0f0f8' }}>Create Room</h2>
                        <form onSubmit={handleCreate}>
                            {/* Name */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7a7a9a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Room Name</label>
                                <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Team Standup" required maxLength={80}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14, boxSizing: 'border-box',
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#f0f0f8', outline: 'none',
                                    }}
                                />
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7a7a9a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Description (optional)</label>
                                <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                                    placeholder="What's this meeting about?" rows={2} maxLength={200}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14, boxSizing: 'border-box',
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#f0f0f8', outline: 'none', resize: 'none',
                                    }}
                                />
                            </div>

                            {/* Room type */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7a7a9a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Room Type</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    {(['public', 'private', 'password_protected'] as Room['type'][]).map(type => (
                                        <button key={type} type="button"
                                            onClick={() => setFormData(f => ({ ...f, type }))}
                                            style={{
                                                padding: '10px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                                                cursor: 'pointer', textTransform: 'capitalize',
                                                background: formData.type === type ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                                                color: formData.type === type ? '#a855f7' : '#8b8ba8',
                                                border: formData.type === type ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                            }}>
                                            {type.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Password field */}
                            {formData.type === 'password_protected' && (
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7a7a9a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Password</label>
                                    <input type="password" value={formData.password}
                                        onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                                        placeholder="Room password" required
                                        style={{
                                            width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14, boxSizing: 'border-box',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#f0f0f8', outline: 'none',
                                        }}
                                    />
                                </div>
                            )}

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                                <button type="button" onClick={() => setShowCreate(false)} style={{
                                    flex: 1, padding: '12px', borderRadius: 12, fontSize: 13, fontWeight: 500,
                                    background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#8b8ba8', cursor: 'pointer',
                                }}>Cancel</button>
                                <button type="submit" disabled={creating || !formData.name.trim()} style={{
                                    flex: 1, padding: '12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                    border: 'none', color: '#fff', cursor: 'pointer',
                                    opacity: (creating || !formData.name.trim()) ? 0.5 : 1,
                                }}>
                                    {creating ? 'Creating...' : 'Create Room'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
