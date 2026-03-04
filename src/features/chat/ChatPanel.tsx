import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, Smile, X, Trash2 } from 'lucide-react'
import { useChatStore } from './chatStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useRoomStore } from '@/features/rooms/roomStore'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏']

interface ChatPanelProps {
    roomId: string
    onClose?: () => void
}

export function ChatPanel({ roomId, onClose }: ChatPanelProps) {
    const [input, setInput] = useState('')
    const [showEmoji, setShowEmoji] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const { messages, typingUsers, sendMessage, editMessage, deleteMessage, clearUnread, subscribeToRoom } = useChatStore()
    const { user, profile } = useAuthStore()
    const { currentRoom } = useRoomStore()

    const isHost = currentRoom?.host_id === user?.id

    useEffect(() => {
        const unsub = subscribeToRoom(roomId)
        clearUnread()
        return unsub
    }, [roomId, subscribeToRoom, clearUnread])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = useCallback(async () => {
        if (!input.trim() || !user) return
        if (editingId) {
            await editMessage(editingId, input.trim())
            setEditingId(null)
        } else {
            await sendMessage(roomId, user.id, input.trim())
        }
        setInput('')
    }, [input, editingId, user, roomId, sendMessage, editMessage])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleDelete = useCallback(async (messageId: string) => {
        await deleteMessage(messageId)
    }, [deleteMessage])

    const activeTypers = Object.entries(typingUsers)
        .filter(([uid, t]) => uid !== user?.id && Date.now() - t.timestamp < 3000)
        .map(([, t]) => t.username)

    return (
        <div className="panel-container">
            {/* Header */}
            <div className="panel-header">
                <h3 className="panel-title">Room Chat</h3>
                {onClose && (
                    <button className="panel-close-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#4a4a6a', fontSize: 13 }}>
                        No messages yet. Start the conversation!
                    </div>
                )}

                {messages.map(msg => {
                    const isOwn = msg.user_id === user?.id
                    const canDelete = isOwn || isHost

                    return (
                        <div key={msg.id} style={{
                            display: 'flex', gap: 8, marginBottom: 12,
                            flexDirection: isOwn ? 'row-reverse' : 'row',
                        }}>
                            {/* Avatar */}
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, color: '#fff',
                                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                overflow: 'hidden',
                            }}>
                                {msg.profile?.avatar_url
                                    ? <img src={msg.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : (msg.profile?.username?.[0] || '?').toUpperCase()}
                            </div>

                            <div style={{
                                maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 2,
                                alignItems: isOwn ? 'flex-end' : 'flex-start',
                            }}>
                                {!isOwn && (
                                    <span style={{ fontSize: 11, color: '#6b6b8a', paddingLeft: 4 }}>
                                        {msg.profile?.display_name || msg.profile?.username}
                                    </span>
                                )}
                                <div style={{
                                    padding: '8px 14px', fontSize: 13, wordBreak: 'break-word',
                                    color: '#f0f0f8', lineHeight: 1.5,
                                    background: isOwn ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                                    border: isOwn ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: isOwn ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                                }}>
                                    {msg.type === 'system'
                                        ? <span style={{ color: '#6b6b8a', fontStyle: 'italic' }}>{msg.content}</span>
                                        : msg.content}
                                    {msg.is_edited && <span style={{ fontSize: 10, marginLeft: 4, color: '#4a4a6a' }}>(edited)</span>}
                                </div>

                                {/* Actions row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
                                    <span style={{ fontSize: 10, color: '#4a4a6a' }}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isOwn && (
                                        <button onClick={() => { setEditingId(msg.id); setInput(msg.content) }}
                                            style={{ fontSize: 10, color: '#4a4a6a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                            Edit
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => handleDelete(msg.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 2,
                                                fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                                opacity: 0.7,
                                            }}>
                                            <Trash2 size={10} /> Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Typing indicator */}
                {activeTypers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 5, height: 5, borderRadius: '50%', background: '#6b6b8a',
                                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                                }} />
                            ))}
                        </div>
                        <span style={{ fontSize: 12, color: '#6b6b8a' }}>
                            {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker */}
            {showEmoji && (
                <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => { setInput(i => i + emoji); setShowEmoji(false) }}
                            style={{ fontSize: 18, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* Edit indicator */}
            {editingId && (
                <div style={{
                    padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(124,58,237,0.08)', borderTop: '1px solid rgba(124,58,237,0.15)',
                }}>
                    <span style={{ fontSize: 12, color: '#a855f7' }}>Editing message</span>
                    <button onClick={() => { setEditingId(null); setInput('') }}
                        style={{ color: '#6b6b8a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Input */}
            <div style={{ padding: '8px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <button onClick={() => setShowEmoji(s => !s)}
                        style={{ color: '#6b6b8a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <Smile size={16} />
                    </button>
                    <input
                        value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="Type a message..." maxLength={4096}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 13, color: '#f0f0f8', fontFamily: 'inherit',
                        }}
                    />
                    <button onClick={handleSend} disabled={!input.trim()}
                        style={{
                            padding: 4, borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: 'none',
                            color: input.trim() ? '#7c3aed' : '#3a3a5a',
                            opacity: input.trim() ? 1 : 0.4,
                        }}>
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
