import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './authStore'

export function AuthGuard() {
    const { session, isInitialized } = useAuthStore()

    if (!isInitialized) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#0a0a0f',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        border: '3px solid rgba(124,58,237,0.3)',
                        borderTopColor: '#7c3aed',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <p style={{ color: '#8b8ba8', fontSize: 13 }}>Loading Meetix...</p>
                </div>
            </div>
        )
    }

    return session ? <Outlet /> : <Navigate to="/auth/login" replace />
}

export function GuestGuard() {
    const { session, isInitialized } = useAuthStore()
    if (!isInitialized) return null
    return !session ? <Outlet /> : <Navigate to="/" replace />
}
