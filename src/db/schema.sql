-- Creativeprocess Office production schema

CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color VARCHAR(30) NOT NULL DEFAULT '#D9A34A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color VARCHAR(30) NOT NULL DEFAULT '#D9A34A',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO floors (id, name, description, color, sort_order)
SELECT 'main-floor', 'Main Floor', 'The default workspace floor', '#D9A34A', 0
WHERE NOT EXISTS (SELECT 1 FROM floors);

INSERT INTO floors (id, name, description, color, sort_order) VALUES
  ('sale-floor', 'Sale Floor', 'Reserved for the sales team', '#38BDF8', 1),
  ('tech-floor', 'Tech Floor', 'Reserved for the technology team', '#8B5CF6', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role VARCHAR(120) NOT NULL DEFAULT 'Member',
  avatar_url TEXT NOT NULL DEFAULT '',
  gender VARCHAR(16) NOT NULL DEFAULT 'male',
  bio VARCHAR(500) NOT NULL DEFAULT '',
  team_id VARCHAR(64) REFERENCES teams(id) ON DELETE SET NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS office_invitations (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token_hash CHAR(64) UNIQUE NOT NULL,
  role VARCHAR(120) NOT NULL DEFAULT 'Member',
  gender VARCHAR(16) NOT NULL DEFAULT 'male',
  default_floor_id VARCHAR(64) REFERENCES floors(id) ON DELETE SET NULL,
  invited_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS office_intro_seen BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_floor_id VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(16) NOT NULL DEFAULT 'male';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500) NOT NULL DEFAULT '';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_default_floor_id_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_default_floor_id_fkey
      FOREIGN KEY (default_floor_id) REFERENCES floors(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL,
  capacity INT NOT NULL DEFAULT 16,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(64);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor_id VARCHAR(64);
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_type_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_type_check CHECK (type IN ('personal', 'meeting', 'theater', 'game'));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_owner_user_id_fkey') THEN
    ALTER TABLE rooms ADD CONSTRAINT rooms_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_floor_id_fkey') THEN
    ALTER TABLE rooms ADD CONSTRAINT rooms_floor_id_fkey
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS presence_status (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'offline',
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_camera_on BOOLEAN NOT NULL DEFAULT false,
  is_sharing_screen BOOLEAN NOT NULL DEFAULT false,
  current_music TEXT,
  custom_status TEXT,
  current_room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE SET NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_occupancy (
  id BIGSERIAL PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_room_user UNIQUE (room_id, user_id),
  CONSTRAINT unique_user_room UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS reactions (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  emoji VARCHAR(16) NOT NULL,
  room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_leaderboard (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  game_name VARCHAR(100) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_game UNIQUE (user_id, game_name)
);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS room_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  status VARCHAR(40),
  room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('dm', 'group', 'channel')),
  name VARCHAR(120),
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  dm_key VARCHAR(140) UNIQUE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  content TEXT NOT NULL DEFAULT '',
  event_type VARCHAR(40),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reply_to_id BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  pinned_at TIMESTAMPTZ,
  pinned_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS pinned_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS chat_message_hidden (
  message_id BIGINT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id BIGINT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS shelf_items (
  id VARCHAR(64) PRIMARY KEY,
  owner_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('image', 'video', 'url', 'sticker')),
  content TEXT NOT NULL,
  title VARCHAR(160),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR(64) PRIMARY KEY,
  owner_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location VARCHAR(200) NOT NULL DEFAULT '',
  meeting_url TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#D9A34A',
  all_day BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS stories (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('image', 'video', 'text')),
  content TEXT NOT NULL,
  caption VARCHAR(240) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_default_floor_id ON users(default_floor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor_id ON rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_office_invitations_email ON office_invitations(lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_room_id ON room_occupancy(room_id);
CREATE INDEX IF NOT EXISTS idx_reactions_created_at ON reactions(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_owner_user_id ON rooms(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_sessions_open_user ON activity_sessions(user_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_sessions_open_user ON room_sessions(user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_sessions_user_started ON activity_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_sessions_user_joined ON room_sessions(user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_sessions_room_joined ON room_sessions(room_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_created ON activity_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_search ON chat_messages USING gin(to_tsvector('simple', content));
CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON chat_messages(conversation_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_start ON calendar_events(owner_user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_shelf_items_owner_order ON shelf_items(owner_user_id, sort_order, created_at);
