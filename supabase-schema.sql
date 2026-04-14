-- Players Table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  region TEXT,
  club TEXT,
  ranking_points INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles Table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL,
  is_custom BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Roles Table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES players(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournaments Table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stage_type TEXT DEFAULT 'single' CHECK (stage_type IN ('single', 'two_stage')),
  stage1_format TEXT NOT NULL,
  stage2_format TEXT,
  date DATE NOT NULL,
  is_ranking_tournament BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  fixed_decks BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches Table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'grabbed', 'in_progress', 'logged', 'submitted')),
  referee_id UUID REFERENCES players(id),
  scores JSONB DEFAULT '{"player1": 0, "player2": 0, "sets": []}',
  winner_id UUID REFERENCES players(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Match Logs Table (Updated to include bey_id)
CREATE TABLE match_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  bey_id UUID, -- Will be linked to beyblades table later
  finish_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Match Corrections Table
CREATE TABLE match_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  corrected_by UUID REFERENCES players(id),
  original_data JSONB NOT NULL,
  new_data JSONB NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts Table
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('blade', 'ratchet', 'bit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beyblades Table
CREATE TABLE beyblades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  blade_id UUID REFERENCES parts(id),
  ratchet_id UUID REFERENCES parts(id),
  bit_id UUID REFERENCES parts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decks Table
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bey1_id UUID REFERENCES beyblades(id),
  bey2_id UUID REFERENCES beyblades(id),
  bey3_id UUID REFERENCES beyblades(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament Decks Table
CREATE TABLE tournament_decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  is_fixed BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'flagged')),
  declared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES players(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Courts Table
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update Tournaments Table
-- (Columns already added in the main table definition above for fresh installs)
-- For existing installs, we would run:
-- ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS stage_type TEXT DEFAULT 'single' CHECK (stage_type IN ('single', 'two_stage'));
-- ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS stage1_format TEXT;
-- ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS stage2_format TEXT;
-- ALTER TABLE tournaments RENAME COLUMN is_ranking TO is_ranking_tournament;
-- ALTER TABLE tournaments DROP COLUMN IF EXISTS tier_multiplier;
-- ALTER TABLE tournaments DROP COLUMN IF EXISTS format;

-- Update Matches Table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES courts(id) ON DELETE SET NULL;

-- Update Match Logs to link bey_id
ALTER TABLE match_logs ADD CONSTRAINT fk_match_logs_bey FOREIGN KEY (bey_id) REFERENCES beyblades(id);

-- Tournament Entrants Table
CREATE TABLE tournament_entrants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered',
  placement INTEGER,
  points_awarded INTEGER DEFAULT 0,
  UNIQUE(tournament_id, player_id)
);

-- Account Claims Table
CREATE TABLE account_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  discord_username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES players(id)
);

-- Placement Points Table
CREATE TABLE placement_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_size_min INTEGER NOT NULL,
  tournament_size_max INTEGER NOT NULL,
  placement INTEGER NOT NULL,
  points INTEGER NOT NULL
);

-- Points Scale Table
CREATE TABLE points_scale (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  placement TEXT UNIQUE NOT NULL,
  points INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Points Scale Data
INSERT INTO points_scale (placement, points) VALUES
('1st', 12),
('2nd', 8),
('3rd', 6),
('4th', 4),
('5th-8th', 3),
('Outside top 8', 1);

-- Function to award points after tournament completion
CREATE OR REPLACE FUNCTION award_tournament_points(t_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t_record RECORD;
  e_record RECORD;
  p_points INTEGER;
  total_awarded INTEGER := 0;
  summary JSONB := '[]'::JSONB;
BEGIN
  -- Get tournament info
  SELECT * INTO t_record FROM tournaments WHERE id = t_id;
  
  IF t_record.status != 'completed' THEN
    RAISE EXCEPTION 'Tournament must be completed before awarding points';
  END IF;

  IF NOT t_record.is_ranking_tournament THEN
    RETURN '{"message": "Not a ranking tournament"}'::JSONB;
  END IF;

  -- Loop through entrants
  FOR e_record IN SELECT * FROM tournament_entrants WHERE tournament_id = t_id LOOP
    -- Find base points from placement_points table
    -- (Simplified: if no exact match, we might need a more complex lookup, but assuming table is populated)
    SELECT points INTO p_points 
    FROM placement_points 
    WHERE placement = e_record.placement 
      AND (SELECT count(*) FROM tournament_entrants WHERE tournament_id = t_id) BETWEEN tournament_size_min AND tournament_size_max;

    IF p_points IS NULL THEN
      p_points := 0;
    END IF;

    -- Update entrant record
    UPDATE tournament_entrants 
    SET points_awarded = p_points 
    WHERE id = e_record.id;

    -- Update player record
    UPDATE players 
    SET ranking_points = ranking_points + p_points 
    WHERE id = e_record.player_id;

    total_awarded := total_awarded + p_points;
    summary := summary || jsonb_build_object('player_id', e_record.player_id, 'points', p_points);
  END LOOP;

  RETURN jsonb_build_object('total_awarded', total_awarded, 'details', summary);
END;
$$;

-- Initial Roles Data
INSERT INTO roles (name, description, is_custom, permissions) VALUES
('Player', 'Standard player account', false, '{
  "can_view_rankings": true,
  "can_view_profiles": true,
  "can_edit_own_profile": true,
  "can_grab_matches": false,
  "can_score_matches": false,
  "can_submit_matches": false,
  "can_create_tournaments": false,
  "can_complete_tournaments": false,
  "can_manage_refs": false,
  "can_manage_players": false,
  "can_manage_roles": false,
  "can_access_admin_panel": false,
  "can_view_bracket": true,
  "can_view_meta": true,
  "can_manage_own_parts": true,
  "can_manage_own_decks": true,
  "can_register_for_tournaments": true,
  "can_declare_deck": true,
  "can_manage_courts": false,
  "can_approve_registrations": false,
  "can_approve_decks": false,
  "can_edit_points_scale": false
}'),
('Referee', 'Tournament official', false, '{
  "can_view_rankings": true,
  "can_view_profiles": true,
  "can_edit_own_profile": true,
  "can_grab_matches": true,
  "can_score_matches": true,
  "can_submit_matches": true,
  "can_create_tournaments": false,
  "can_complete_tournaments": false,
  "can_manage_refs": false,
  "can_manage_players": false,
  "can_manage_roles": false,
  "can_access_admin_panel": false,
  "can_view_bracket": true,
  "can_view_meta": true,
  "can_manage_own_parts": true,
  "can_manage_own_decks": true,
  "can_register_for_tournaments": true,
  "can_declare_deck": true,
  "can_manage_courts": false,
  "can_approve_registrations": false,
  "can_approve_decks": false,
  "can_edit_points_scale": false
}'),
('Ops', 'Tournament operations', false, '{
  "can_view_rankings": true,
  "can_view_profiles": true,
  "can_edit_own_profile": true,
  "can_grab_matches": true,
  "can_score_matches": true,
  "can_submit_matches": true,
  "can_create_tournaments": true,
  "can_complete_tournaments": true,
  "can_manage_refs": true,
  "can_manage_players": true,
  "can_manage_roles": false,
  "can_access_admin_panel": false,
  "can_view_bracket": true,
  "can_view_meta": true,
  "can_manage_own_parts": true,
  "can_manage_own_decks": true,
  "can_register_for_tournaments": true,
  "can_declare_deck": true,
  "can_manage_courts": true,
  "can_approve_registrations": true,
  "can_approve_decks": true,
  "can_edit_points_scale": false
}'),
('Admin', 'Full system access', false, '{
  "can_view_rankings": true,
  "can_view_profiles": true,
  "can_edit_own_profile": true,
  "can_grab_matches": true,
  "can_score_matches": true,
  "can_submit_matches": true,
  "can_create_tournaments": true,
  "can_complete_tournaments": true,
  "can_manage_refs": true,
  "can_manage_players": true,
  "can_manage_roles": true,
  "can_access_admin_panel": true,
  "can_view_bracket": true,
  "can_view_meta": true,
  "can_manage_own_parts": true,
  "can_manage_own_decks": true,
  "can_register_for_tournaments": true,
  "can_declare_deck": true,
  "can_manage_courts": true,
  "can_approve_registrations": true,
  "can_approve_decks": true,
  "can_edit_points_scale": true
}');

-- Initial Placement Points
INSERT INTO placement_points (tournament_size_min, tournament_size_max, placement, points) VALUES
(8, 16, 1, 100),
(8, 16, 2, 75),
(8, 16, 3, 50),
(8, 16, 4, 25),
(17, 32, 1, 200),
(17, 32, 2, 150),
(17, 32, 3, 100),
(17, 32, 4, 75),
(17, 32, 5, 50),
(17, 32, 6, 50),
(17, 32, 7, 50),
(17, 32, 8, 50),
(33, 64, 1, 400),
(33, 64, 2, 300),
(33, 64, 3, 200),
(33, 64, 4, 150),
(33, 64, 5, 100),
(33, 64, 6, 100),
(33, 64, 7, 100),
(33, 64, 8, 100);
