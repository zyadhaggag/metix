-- ============================================================
-- MEETIX — Full Database Schema Migration
-- Version: 1.0.0
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
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

-- ============================================================
-- 2. ROOMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'public'
                    CHECK (type IN ('public','private','password_protected')),
  password_hash   TEXT,                         -- bcrypt hash, only for password_protected
  invite_token    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  host_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
  max_participants INTEGER NOT NULL DEFAULT 50,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ                   -- soft delete
);

CREATE INDEX idx_rooms_type       ON public.rooms(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_rooms_host_id    ON public.rooms(host_id);
CREATE INDEX idx_rooms_invite_token ON public.rooms(invite_token);

-- ============================================================
-- 3. ROOM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.room_members (
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

-- ============================================================
-- 4. ROOM PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.room_permissions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id               UUID NOT NULL UNIQUE REFERENCES public.rooms(id) ON DELETE CASCADE,
  allow_mic             BOOLEAN NOT NULL DEFAULT TRUE,
  allow_camera          BOOLEAN NOT NULL DEFAULT TRUE,
  allow_screen_share    BOOLEAN NOT NULL DEFAULT TRUE,
  allow_chat            BOOLEAN NOT NULL DEFAULT TRUE,
  allow_raise_hand      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. CALL SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  peak_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_call_sessions_room_id ON public.call_sessions(room_id);

-- ============================================================
-- 6. MESSAGES (Public Room Chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
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

-- ============================================================
-- 7. REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message_id ON public.reactions(message_id);

-- ============================================================
-- 8. PRIVATE CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.private_conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint: only one conversation per user pair (order-independent)
  CONSTRAINT unique_conversation_pair CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_private_conv_user_a ON public.private_conversations(user_a_id);
CREATE INDEX idx_private_conv_user_b ON public.private_conversations(user_b_id);

-- ============================================================
-- 9. PRIVATE MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.private_messages (
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

-- ============================================================
-- 10. RAISED HANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.raised_hands (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id   UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

CREATE INDEX idx_raised_hands_room ON public.raised_hands(room_id, raised_at ASC);

-- ============================================================
-- 11. RECORDINGS (Future-Ready)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recordings (
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
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at    BEFORE UPDATE ON public.profiles    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rooms_updated_at       BEFORE UPDATE ON public.rooms       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON public.room_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_messages_updated_at    BEFORE UPDATE ON public.messages    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
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
