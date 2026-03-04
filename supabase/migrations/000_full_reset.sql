-- ============================================================
-- MEETIX — FULL RESET: Drop everything + Recreate from scratch
-- ⚠️ WARNING: This will DELETE ALL DATA
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: Drop all triggers
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_rooms_updated_at ON public.rooms;
DROP TRIGGER IF EXISTS trg_permissions_updated_at ON public.room_permissions;
DROP TRIGGER IF EXISTS trg_messages_updated_at ON public.messages;

-- ============================================================
-- STEP 2: Drop all tables (reverse dependency order)
-- ============================================================
DROP TABLE IF EXISTS public.recordings CASCADE;
DROP TABLE IF EXISTS public.raised_hands CASCADE;
DROP TABLE IF EXISTS public.private_messages CASCADE;
DROP TABLE IF EXISTS public.private_conversations CASCADE;
DROP TABLE IF EXISTS public.reactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.call_sessions CASCADE;
DROP TABLE IF EXISTS public.room_permissions CASCADE;
DROP TABLE IF EXISTS public.room_members CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================
-- STEP 3: Drop all functions
-- ============================================================
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_room_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_room_mod_or_host(UUID, UUID) CASCADE;

-- ============================================================
-- STEP 4: Enable extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- STEP 5: Create all tables
-- ============================================================

-- 1. PROFILES
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  status        TEXT NOT NULL DEFAULT 'offline'
                  CHECK (status IN ('online','away','busy','offline')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_status   ON public.profiles(status);

-- 2. ROOMS
CREATE TABLE public.rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'public'
                    CHECK (type IN ('public','private','password_protected')),
  password_hash   TEXT,
  invite_token    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  host_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
  max_participants INTEGER NOT NULL DEFAULT 50,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_rooms_type         ON public.rooms(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_rooms_host_id      ON public.rooms(host_id);
CREATE INDEX idx_rooms_invite_token ON public.rooms(invite_token);

-- 3. ROOM MEMBERS
CREATE TABLE public.room_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('host','moderator','member')),
  is_muted    BOOLEAN NOT NULL DEFAULT FALSE,
  cam_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  hand_raised BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  UNIQUE (room_id, user_id)
);
CREATE INDEX idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX idx_room_members_active  ON public.room_members(room_id) WHERE left_at IS NULL;

-- 4. ROOM PERMISSIONS
CREATE TABLE public.room_permissions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id               UUID NOT NULL UNIQUE REFERENCES public.rooms(id) ON DELETE CASCADE,
  allow_mic             BOOLEAN NOT NULL DEFAULT TRUE,
  allow_camera          BOOLEAN NOT NULL DEFAULT TRUE,
  allow_screen_share    BOOLEAN NOT NULL DEFAULT TRUE,
  allow_chat            BOOLEAN NOT NULL DEFAULT TRUE,
  allow_raise_hand      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CALL SESSIONS
CREATE TABLE public.call_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  peak_count  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_call_sessions_room_id ON public.call_sessions(room_id);

-- 6. MESSAGES
CREATE TABLE public.messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4096),
  type        TEXT NOT NULL DEFAULT 'text'
                CHECK (type IN ('text','emoji','file','system')),
  file_url    TEXT,
  is_edited   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_room_created ON public.messages(room_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_user_id      ON public.messages(user_id);

-- 7. REACTIONS
CREATE TABLE public.reactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX idx_reactions_message_id ON public.reactions(message_id);

-- 8. PRIVATE CONVERSATIONS
CREATE TABLE public.private_conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_conversation_pair CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX idx_private_conv_user_a ON public.private_conversations(user_a_id);
CREATE INDEX idx_private_conv_user_b ON public.private_conversations(user_b_id);

-- 9. PRIVATE MESSAGES
CREATE TABLE public.private_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.private_conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4096),
  type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','emoji','file')),
  file_url        TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_private_msg_conv_created ON public.private_messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;

-- 10. RAISED HANDS
CREATE TABLE public.raised_hands (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id   UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX idx_raised_hands_room ON public.raised_hands(room_id, raised_at ASC);

-- 11. RECORDINGS
CREATE TABLE public.recordings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES public.call_sessions(id),
  started_by  UUID NOT NULL REFERENCES public.profiles(id),
  storage_path TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','recording','processing','ready','failed')),
  duration_ms INTEGER,
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

-- ============================================================
-- STEP 6: Create trigger functions
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at    BEFORE UPDATE ON public.profiles         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rooms_updated_at       BEFORE UPDATE ON public.rooms            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON public.room_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_messages_updated_at    BEFORE UPDATE ON public.messages         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 7: RLS Helper functions (SECURITY DEFINER = bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id AND left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_mod_or_host(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id AND role IN ('host','moderator') AND left_at IS NULL
  );
$$;

-- ============================================================
-- STEP 8: Enable RLS on all tables
-- ============================================================
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
-- STEP 9: RLS Policies
-- ============================================================

-- PROFILES
CREATE POLICY "profiles: read any"   ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles: insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: delete own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- ROOMS
CREATE POLICY "rooms: read public" ON public.rooms FOR SELECT
  USING (deleted_at IS NULL AND (type = 'public' OR host_id = auth.uid() OR public.is_room_member(id, auth.uid())));
CREATE POLICY "rooms: create authenticated" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "rooms: update by host" ON public.rooms FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "rooms: delete by host" ON public.rooms FOR DELETE USING (host_id = auth.uid());

-- ROOM MEMBERS
CREATE POLICY "room_members: read if in room" ON public.room_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_room_member(room_id, auth.uid()));
CREATE POLICY "room_members: insert self" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_members: update own or host/mod" ON public.room_members FOR UPDATE
  USING (user_id = auth.uid() OR public.is_room_mod_or_host(room_id, auth.uid()));
CREATE POLICY "room_members: delete self or host/mod" ON public.room_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_mod_or_host(room_id, auth.uid()));

-- ROOM PERMISSIONS
CREATE POLICY "room_permissions: read if member" ON public.room_permissions FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "room_permissions: write by host" ON public.room_permissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));

-- MESSAGES
CREATE POLICY "messages: read if member" ON public.messages FOR SELECT
  USING (deleted_at IS NULL AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "messages: insert if member" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "messages: update own or mod" ON public.messages FOR UPDATE
  USING (user_id = auth.uid() OR public.is_room_mod_or_host(room_id, auth.uid()));
CREATE POLICY "messages: delete own or mod" ON public.messages FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_mod_or_host(room_id, auth.uid()));

-- REACTIONS
CREATE POLICY "reactions: read any"   ON public.reactions FOR SELECT USING (true);
CREATE POLICY "reactions: insert own" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions: delete own" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- PRIVATE CONVERSATIONS
CREATE POLICY "private_conv: read own"   ON public.private_conversations FOR SELECT USING (user_a_id = auth.uid() OR user_b_id = auth.uid());
CREATE POLICY "private_conv: insert own" ON public.private_conversations FOR INSERT WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- PRIVATE MESSAGES
CREATE POLICY "private_msg: read own" ON public.private_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.private_conversations pc WHERE pc.id = conversation_id AND (pc.user_a_id = auth.uid() OR pc.user_b_id = auth.uid())));
CREATE POLICY "private_msg: insert own" ON public.private_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.private_conversations pc WHERE pc.id = conversation_id AND (pc.user_a_id = auth.uid() OR pc.user_b_id = auth.uid())));
CREATE POLICY "private_msg: update own" ON public.private_messages FOR UPDATE USING (sender_id = auth.uid());

-- RAISED HANDS
CREATE POLICY "raised_hands: read if member" ON public.raised_hands FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "raised_hands: insert self" ON public.raised_hands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "raised_hands: delete self or mod" ON public.raised_hands FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_mod_or_host(room_id, auth.uid()));

-- CALL SESSIONS
CREATE POLICY "call_sessions: read if member" ON public.call_sessions FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "call_sessions: write by host" ON public.call_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));

-- RECORDINGS
CREATE POLICY "recordings: read if member" ON public.recordings FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "recordings: manage by host" ON public.recordings FOR ALL USING (started_by = auth.uid());

-- ============================================================
-- STEP 10: Recreate profiles for existing auth users
-- (Important after a reset — existing users lose their profiles)
-- ============================================================
INSERT INTO public.profiles (id, username, display_name, avatar_url, status)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  'offline'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ✅ DONE — All tables, triggers, functions, RLS, and profiles recreated
-- ============================================================
