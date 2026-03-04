import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { AccessToken, RoomServiceClient, TrackType } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

// ── Environment validation ──────────────────────────────────────
const REQUIRED_ENV = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ Missing required env variable: ${key}`)
        process.exit(1)
    }
}

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!
const LIVEKIT_URL = process.env.VITE_LIVEKIT_URL || ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!
const PORT = Number(process.env.SERVER_PORT) || 3001
const ALLOWED_ORIGINS = (process.env.VITE_APP_URL || 'http://localhost:5173').split(',')

// ── Express setup ───────────────────────────────────────────────
const app = express()

app.use(cors({
    origin: true,
    methods: ['POST', 'GET', 'OPTIONS'],
    credentials: true,
}))
app.use(express.json())

// ── Health check ────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() })
})

// ── Rate limit ──────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; resetTime: number }>()

function rateLimitCheck(ip: string): boolean {
    const now = Date.now()
    const entry = rateMap.get(ip) || { count: 0, resetTime: now + 10000 }
    if (now > entry.resetTime) {
        entry.count = 1
        entry.resetTime = now + 10000
    } else {
        entry.count++
        if (entry.count > 10) return false
    }
    rateMap.set(ip, entry)
    return true
}

// ── Supabase client (admin-level for auth verification) ─────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Token generation ────────────────────────────────────────────
function createToken(roomName: string, userId: string, displayName: string, role: string): Promise<string> {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: userId,
        name: displayName,
    })

    const isHostOrMod = role === 'host' || role === 'moderator'
    at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
        roomAdmin: isHostOrMod,
    })

    return at.toJwt()
}

// ── POST /api/livekit/token ─────────────────────────────────────
app.post('/api/livekit/token', async (req: Request, res: Response) => {
    try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown'
        if (!rateLimitCheck(ip)) {
            return res.status(429).json({ error: 'Too many requests' })
        }

        const { roomId, userId, username, authToken } = req.body
        if (!roomId || !userId || !username || !authToken) {
            return res.status(400).json({ error: 'Missing required parameters' })
        }

        // 1. Verify auth token
        const { data: authData, error: authError } = await supabase.auth.getUser(authToken)
        if (authError || !authData.user || authData.user.id !== userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // 2. Check room membership using user's JWT (passes RLS)
        const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${authToken}` } },
        })

        const { data: memberData, error: memberError } = await userSupabase
            .from('room_members')
            .select('role')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .is('left_at', null)
            .maybeSingle()

        if (memberError || !memberData) {
            return res.status(403).json({ error: 'Not a member of this room' })
        }

        // 3. Issue token
        const token = await createToken(roomId, userId, username, memberData.role)
        res.json({ token, role: memberData.role })
    } catch (e: unknown) {
        console.error('[token]', e instanceof Error ? e.message : e)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// ── LiveKit Room Service (server-to-server) ─────────────────────
const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

// ── POST /api/livekit/mute ──────────────────────────────────────
app.post('/api/livekit/mute', async (req: Request, res: Response) => {
    try {
        const { roomId, targetIdentity } = req.body
        if (!roomId || !targetIdentity) return res.status(400).json({ error: 'Missing parameters' })

        const participant = await roomService.getParticipant(roomId, targetIdentity)
        const audioTracks = participant.tracks.filter(t => t.type === TrackType.AUDIO)

        for (const track of audioTracks) {
            await roomService.mutePublishedTrack(roomId, targetIdentity, track.sid, true)
        }
        res.json({ success: true })
    } catch (e) {
        console.error('[mute]', e instanceof Error ? e.message : e)
        res.status(500).json({ error: 'Failed to mute' })
    }
})

// ── POST /api/livekit/kick ──────────────────────────────────────
app.post('/api/livekit/kick', async (req: Request, res: Response) => {
    try {
        const { roomId, targetIdentity } = req.body
        if (!roomId || !targetIdentity) return res.status(400).json({ error: 'Missing parameters' })

        await roomService.removeParticipant(roomId, targetIdentity)
        res.json({ success: true })
    } catch (e) {
        console.error('[kick]', e instanceof Error ? e.message : e)
        res.status(500).json({ error: 'Failed to kick' })
    }
})

// ── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅ Token Server running on port ${PORT}`)
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
    console.log(`   LiveKit URL: ${LIVEKIT_URL}`)
})
