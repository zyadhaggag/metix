import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { AccessToken } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Rate limiting (simple in-memory)
const rateLimit = new Map()

const createToken = (roomName: string, participantName: string, role: string) => {
    // If not set, this will throw
    const at = new AccessToken(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
        {
            identity: participantName,
            name: participantName,
        }
    )

    const isHostOrMod = role === 'host' || role === 'moderator'

    at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
        roomAdmin: isHostOrMod, // Only hosts/mods get room admin
    })

    return at.toJwt()
}

// Supabase client for verification
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
)

app.post('/api/livekit/token', async (req, res) => {
    try {
        // Basic Rate Limiting: 10 requests per 10 seconds per IP
        const ip = req.ip || req.socket.remoteAddress || 'unknown'
        const now = Date.now()
        const userLimit = rateLimit.get(ip) || { count: 0, resetTime: now + 10000 }
        
        if (now > userLimit.resetTime) {
            userLimit.count = 1
            userLimit.resetTime = now + 10000
        } else {
            userLimit.count++
            if (userLimit.count > 10) {
                return res.status(429).json({ error: 'Too many requests' })
            }
        }
        rateLimit.set(ip, userLimit)

        const { roomId, userId, username, authToken } = req.body

        if (!roomId || !userId || !username || !authToken) {
            return res.status(400).json({ error: 'Missing required parameters' })
        }

        // Verify the user's auth token with Supabase to ensure they are who they say they are
        const { data: authData, error: authError } = await supabase.auth.getUser(authToken)
        
        if (authError || !authData.user || authData.user.id !== userId) {
            return res.status(401).json({ error: 'Unauthorized: Invalid auth token' })
        }

        // Validate that this user is actually a member of this room
        const { data: memberData, error: memberError } = await supabase
            .from('room_members')
            .select('role')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .is('left_at', null)
            .single()

        if (memberError || !memberData) {
            return res.status(403).json({ error: 'Forbidden: You are not a member of this room' })
        }

        const token = createToken(roomId, username, memberData.role)
        res.json({ token, role: memberData.role })

    } catch (e) {
        console.error('Token generation error:', e)
        res.status(500).json({ error: 'Server error' })
    }
})

const PORT = process.env.SERVER_PORT || 3001
app.listen(PORT, () => {
    console.log(`LiveKit Token Server running on port ${PORT}`)
})
