-- ====================================================================
-- CREATIVEPROCESS OFFICE - POSTGRESQL DATABASE SCHEMA (DDL)
-- ====================================================================

-- 1. TEAMS / DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  color VARCHAR(30) DEFAULT '#F59E0B',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(120) NOT NULL,
  avatar_url TEXT NOT NULL,
  team_id VARCHAR(64) REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(30) CHECK (type IN ('meeting', 'theater', 'game')) NOT NULL,
  capacity INT DEFAULT 16,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PRESENCE STATUS TABLE
CREATE TABLE IF NOT EXISTS presence_status (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(40) DEFAULT 'online',
  is_muted BOOLEAN DEFAULT false,
  is_camera_on BOOLEAN DEFAULT false,
  is_sharing_screen BOOLEAN DEFAULT false,
  current_music TEXT,
  custom_status TEXT,
  current_room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE SET NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ROOM OCCUPANCY TABLE
CREATE TABLE IF NOT EXISTS room_occupancy (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_room_user UNIQUE (room_id, user_id)
);

-- 6. REACTIONS AND EMOJI EVENTS TABLE
CREATE TABLE IF NOT EXISTS reactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  emoji VARCHAR(10) NOT NULL,
  room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. GAME LEADERBOARD TABLE
CREATE TABLE IF NOT EXISTS game_leaderboard (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  game_name VARCHAR(100) DEFAULT 'Arcade Rally',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- INDEXES FOR OPTIMAL QUERY PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_presence_user_id ON presence_status(user_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_room_id ON room_occupancy(room_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_user_id ON room_occupancy(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_created_at ON reactions(created_at);

-- ====================================================================
-- SEED DATA FOR DEMO APPLICATION
-- ====================================================================
INSERT INTO teams (id, name, description, color) VALUES
  ('team-rnd', 'R&D', 'Research, Core Architecture & Innovation', '#3B82F6'),
  ('team-commercial', 'Commercial', 'Sales, Client Success & Enterprise Partnerships', '#10B981'),
  ('team-marketing', 'Marketing', 'Brand Strategy, Growth & Creative Content', '#EC4899'),
  ('team-product', 'Product & Design', 'Product Strategy, UX/UI & System Architecture', '#F59E0B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, name, type, capacity, description) VALUES
  ('room-meeting', 'Executive Meeting Room', 'meeting', 12, 'High-definition WebRTC video conference space for strategy reviews.'),
  ('room-theater', 'Mainstage Theater', 'theater', 50, 'Audience hall with presentation stage and real-time reaction stream.'),
  ('room-game', 'Arcade Game Lounge', 'game', 8, 'Casual lounge with competitive mini-game leaderboards and chill vibes.')
ON CONFLICT (id) DO NOTHING;
