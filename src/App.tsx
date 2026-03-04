import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { AuthGuard, GuestGuard } from '@/features/auth/AuthGuard'
import { useAuthStore } from '@/features/auth/authStore'
import { useRoomStore } from '@/features/rooms/roomStore'
import { LobbyScreen } from '@/features/call/components/LobbyScreen'
import { CallRoom } from '@/features/call/components/CallRoom'
import { supabase } from '@/lib/supabase'

// Lazy load heavy pages
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const RoomsPage = lazy(() => import('@/features/rooms/RoomsPage'))

const PageLoader = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0a0f',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      border: '3px solid rgba(124,58,237,0.3)',
      borderTopColor: '#7c3aed',
      animation: 'spin 0.8s linear infinite',
    }} />
  </div>
)

/** Room page: lobby → call flow */
function RoomPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentRoom, joinRoom, isLoading, error } = useRoomStore()
  const [inLobby, setInLobby] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)

  useEffect(() => {
    if (id && !currentRoom) {
      joinRoom(id).catch(() => navigate('/'))
    }
  }, [id, currentRoom, joinRoom, navigate])

  const handleJoin = async () => {
    try {
      setTokenError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(`${import.meta.env.VITE_TOKEN_SERVER_URL}/api/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: id,
          userId: session.user.id,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Unknown User',
          authToken: session.access_token
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to get token')
      }

      const data = await res.json()
      setToken(data.token)
      setInLobby(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join room'
      // User-friendly messages for common failures
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED')) {
        setTokenError('Cannot reach the server. Please ensure the token server is running.')
      } else {
        setTokenError(msg)
      }
    }
  }

  if (!id) return <Navigate to="/" replace />

  if (error || tokenError) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 500, color: '#ef4444', marginBottom: 16 }}>{error || tokenError}</p>
        <button onClick={() => navigate('/')} style={{
          padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 500,
          background: 'rgba(124,58,237,0.15)', color: '#a855f7',
          border: '1px solid rgba(124,58,237,0.25)', cursor: 'pointer',
        }}>Back to Rooms</button>
      </div>
    </div>
  )

  if (inLobby || !token) {
    return (
      <LobbyScreen
        roomName={currentRoom?.name ?? 'Loading...'}
        onJoin={handleJoin}
        isLoading={isLoading}
      />
    )
  }

  return <CallRoom roomId={id} token={token} />
}

/** Invite token handler */
function InviteHandler() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { joinRoom } = useRoomStore()

  useEffect(() => {
    if (!token) { navigate('/'); return }

    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('rooms').select('id').eq('invite_token', token).maybeSingle()
        .then(({ data }) => {
          const room = data as { id: string } | null
          if (room) {
            joinRoom(room.id).then(() => navigate(`/room/${room.id}`))
          } else {
            navigate('/')
          }
        })
    })
  }, [token, joinRoom, navigate])

  return <PageLoader />
}

export default function App() {
  const { initialize, isInitialized } = useAuthStore()

  useEffect(() => { initialize() }, [initialize])

  if (!isInitialized) return <PageLoader />

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Guest only routes */}
          <Route element={<GuestGuard />}>
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
          </Route>

          {/* Auth callback (after OAuth redirect) */}
          <Route path="/auth/callback" element={<Navigate to="/" replace />} />

          {/* Protected routes */}
          <Route element={<AuthGuard />}>
            <Route path="/" element={<RoomsPage />} />
            <Route path="/room/:id" element={<RoomPage />} />
            <Route path="/room/join/:token" element={<InviteHandler />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
