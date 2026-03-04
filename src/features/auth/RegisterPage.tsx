import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from './authStore'
import { Video, Mail, Lock, User, Eye, EyeOff, AlertCircle, Chrome } from 'lucide-react'

export default function RegisterPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const { signUp, signInWithGoogle, isLoading } = useAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        try {
            await signUp(email, password, username)
            navigate('/')
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Registration failed')
        }
    }

    const inputCSS: React.CSSProperties = {
        width: '100%',
        padding: '14px 16px 14px 44px',
        borderRadius: 12,
        fontSize: 14,
        outline: 'none',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#f0f0f8',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s, box-shadow 0.2s',
    }

    const labelCSS: React.CSSProperties = {
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: '#7a7a9a',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
    }

    const iconCSS: React.CSSProperties = {
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#5a5a7a',
    }

    const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.style.borderColor = 'rgba(124,58,237,0.5)'
        e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)'
    }
    const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.style.borderColor = 'rgba(255,255,255,0.1)'
        e.target.style.boxShadow = 'none'
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            background: '#0a0a0f',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            {/* Glow orbs */}
            <div style={{
                position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)',
                width: 700, height: 700, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)',
                filter: 'blur(100px)', pointerEvents: 'none',
            }} />

            <div style={{ width: '100%', maxWidth: 430, position: 'relative', zIndex: 1 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                            boxShadow: '0 6px 24px rgba(124,58,237,0.4)',
                        }}>
                            <Video size={24} color="#fff" />
                        </div>
                        <span className="text-gradient" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>Meetix</span>
                    </div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f0f0f8', margin: 0 }}>Create an account</h1>
                    <p style={{ fontSize: 14, color: '#6b6b8a', marginTop: 8 }}>Start meeting in seconds</p>
                </div>

                {/* Card */}
                <div style={{
                    borderRadius: 24,
                    padding: '36px 32px',
                    background: 'rgba(18, 18, 28, 0.85)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
                }}>
                    {/* Google button */}
                    <button onClick={signInWithGoogle} disabled={isLoading} style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '14px 20px',
                        borderRadius: 16,
                        fontSize: 14, fontWeight: 500,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#e0e0f0',
                        cursor: 'pointer',
                    }}>
                        <Chrome size={18} color="#a78bfa" />
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                        <span style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }}>or</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Username */}
                        <div style={{ marginBottom: 24 }}>
                            <label style={labelCSS}>Username</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={iconCSS} />
                                <input type="text" value={username}
                                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    placeholder="john_doe" required minLength={3} maxLength={30}
                                    style={inputCSS} onFocus={onFocus} onBlur={onBlur}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div style={{ marginBottom: 24 }}>
                            <label style={labelCSS}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={iconCSS} />
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com" required
                                    style={inputCSS} onFocus={onFocus} onBlur={onBlur}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 28 }}>
                            <label style={labelCSS}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={iconCSS} />
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8}
                                    style={{ ...inputCSS, paddingRight: 48 }}
                                    onFocus={onFocus} onBlur={onBlur}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#5a5a7a',
                                    }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 16px', borderRadius: 12, fontSize: 13,
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                                color: '#f87171', marginBottom: 20,
                            }}>
                                <AlertCircle size={15} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button type="submit" disabled={isLoading} style={{
                            width: '100%', padding: '14px', borderRadius: 14,
                            fontSize: 14, fontWeight: 600, color: '#fff',
                            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
                            opacity: isLoading ? 0.6 : 1,
                        }}>
                            {isLoading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', fontSize: 14, color: '#6b6b8a', marginTop: 28 }}>
                        Already have an account?{' '}
                        <Link to="/auth/login" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </p>
                </div>

                <p style={{ textAlign: 'center', fontSize: 11, color: '#3a3a5a', marginTop: 24 }}>
                    Secured by Supabase Auth • Enterprise-grade encryption
                </p>
            </div>
        </div>
    )
}
