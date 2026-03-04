-- ============================================================
-- MEETIX — Row Level Security Policies
-- Safe to re-run: drops existing policies before recreating
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raised_hands         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles: read any" ON public.profiles;
CREATE POLICY "profiles: read any"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles: insert own" ON public.profiles;
CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: delete own" ON public.profiles;
CREATE POLICY "profiles: delete own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================================
-- Helper: check membership bypassing RLS (avoids infinite recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id AND left_at IS NULL
  );
$$;

-- ============================================================
-- Helper: check host/mod role bypassing RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_room_mod_or_host(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id AND role IN ('host','moderator') AND left_at IS NULL
  );
$$;

-- ============================================================
-- ROOMS
-- ============================================================
DROP POLICY IF EXISTS "rooms: read public" ON public.rooms;
CREATE POLICY "rooms: read public"
  ON public.rooms FOR SELECT
  USING (
    deleted_at IS NULL AND (
      type = 'public'
      OR host_id = auth.uid()
      OR public.is_room_member(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "rooms: create authenticated" ON public.rooms;
CREATE POLICY "rooms: create authenticated"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "rooms: update by host" ON public.rooms;
CREATE POLICY "rooms: update by host"
  ON public.rooms FOR UPDATE
  USING (host_id = auth.uid());

DROP POLICY IF EXISTS "rooms: delete by host" ON public.rooms;
CREATE POLICY "rooms: delete by host"
  ON public.rooms FOR DELETE
  USING (host_id = auth.uid());

-- ============================================================
-- ROOM MEMBERS
-- ============================================================
DROP POLICY IF EXISTS "room_members: read if in room" ON public.room_members;
CREATE POLICY "room_members: read if in room"
  ON public.room_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "room_members: insert self" ON public.room_members;
CREATE POLICY "room_members: insert self"
  ON public.room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "room_members: update own or host/mod" ON public.room_members;
CREATE POLICY "room_members: update own or host/mod"
  ON public.room_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('host','moderator')
        AND rm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "room_members: delete self or host/mod" ON public.room_members;
CREATE POLICY "room_members: delete self or host/mod"
  ON public.room_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('host','moderator')
        AND rm.left_at IS NULL
    )
  );

-- ============================================================
-- ROOM PERMISSIONS
-- ============================================================
DROP POLICY IF EXISTS "room_permissions: read if member" ON public.room_permissions;
CREATE POLICY "room_permissions: read if member"
  ON public.room_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid() AND rm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "room_permissions: write by host" ON public.room_permissions;
CREATE POLICY "room_permissions: write by host"
  ON public.room_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()
    )
  );

-- ============================================================
-- MESSAGES (Public Room Chat)
-- ============================================================
DROP POLICY IF EXISTS "messages: read if member" ON public.messages;
CREATE POLICY "messages: read if member"
  ON public.messages FOR SELECT
  USING (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid() AND rm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "messages: insert if member" ON public.messages;
CREATE POLICY "messages: insert if member"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid() AND rm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "messages: update own or mod" ON public.messages;
CREATE POLICY "messages: update own or mod"
  ON public.messages FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('host','moderator')
        AND rm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "messages: delete own or mod" ON public.messages;
CREATE POLICY "messages: delete own or mod"
  ON public.messages FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('host','moderator')
        AND rm.left_at IS NULL
    )
  );

-- ============================================================
-- REACTIONS
-- ============================================================
DROP POLICY IF EXISTS "reactions: read any" ON public.reactions;
CREATE POLICY "reactions: read any"
  ON public.reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "reactions: insert own" ON public.reactions;
CREATE POLICY "reactions: insert own"
  ON public.reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions: delete own" ON public.reactions;
CREATE POLICY "reactions: delete own"
  ON public.reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- PRIVATE CONVERSATIONS
-- ============================================================
DROP POLICY IF EXISTS "private_conv: read own" ON public.private_conversations;
CREATE POLICY "private_conv: read own"
  ON public.private_conversations FOR SELECT
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

DROP POLICY IF EXISTS "private_conv: insert own" ON public.private_conversations;
CREATE POLICY "private_conv: insert own"
  ON public.private_conversations FOR INSERT
  WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- ============================================================
-- PRIVATE MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "private_msg: read own" ON public.private_messages;
CREATE POLICY "private_msg: read own"
  ON public.private_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.private_conversations pc
      WHERE pc.id = conversation_id
        AND (pc.user_a_id = auth.uid() OR pc.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "private_msg: insert own" ON public.private_messages;
CREATE POLICY "private_msg: insert own"
  ON public.private_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.private_conversations pc
      WHERE pc.id = conversation_id
        AND (pc.user_a_id = auth.uid() OR pc.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "private_msg: update own" ON public.private_messages;
CREATE POLICY "private_msg: update own"
  ON public.private_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- ============================================================
-- RAISED HANDS
-- ============================================================
DROP POLICY IF EXISTS "raised_hands: read if member" ON public.raised_hands;
CREATE POLICY "raised_hands: read if member"
  ON public.raised_hands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid() AND rm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "raised_hands: insert self" ON public.raised_hands;
CREATE POLICY "raised_hands: insert self"
  ON public.raised_hands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "raised_hands: delete self or mod" ON public.raised_hands;
CREATE POLICY "raised_hands: delete self or mod"
  ON public.raised_hands FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id
        AND rm.user_id = auth.uid()
        AND rm.role IN ('host','moderator')
        AND rm.left_at IS NULL
    )
  );

-- ============================================================
-- CALL SESSIONS
-- ============================================================
DROP POLICY IF EXISTS "call_sessions: read if member" ON public.call_sessions;
CREATE POLICY "call_sessions: read if member"
  ON public.call_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "call_sessions: write by host" ON public.call_sessions;
CREATE POLICY "call_sessions: write by host"
  ON public.call_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()
    )
  );

-- ============================================================
-- RECORDINGS
-- ============================================================
DROP POLICY IF EXISTS "recordings: read if member" ON public.recordings;
CREATE POLICY "recordings: read if member"
  ON public.recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "recordings: manage by host" ON public.recordings;
CREATE POLICY "recordings: manage by host"
  ON public.recordings FOR ALL
  USING (started_by = auth.uid());
