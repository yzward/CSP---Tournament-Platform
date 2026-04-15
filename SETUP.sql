-- ============================================================
-- ClashStatsPro — Complete Database Setup
-- Run this single file in Supabase SQL Editor.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT.
-- ============================================================

-- Required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. TEAMS (must exist before players references it) ────────
CREATE TABLE IF NOT EXISTS teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  logo_url     TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. PLAYERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id      TEXT UNIQUE,          -- nullable: Challonge-imported players have no Discord ID
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  email           TEXT,
  region          TEXT,
  club            TEXT,
  ranking_points  INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  startgg_user_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. ROLES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL,
  is_custom   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. USER ROLES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID REFERENCES players(id) ON DELETE CASCADE,
  role_id     UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES players(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. TOURNAMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  stage_type           TEXT DEFAULT 'single' CHECK (stage_type IN ('single', 'two_stage')),
  stage1_format        TEXT NOT NULL DEFAULT 'single_elim',
  stage2_format        TEXT,
  stage1_fixed_decks   BOOLEAN DEFAULT FALSE,
  stage2_fixed_decks   BOOLEAN DEFAULT FALSE,
  held_at              DATE NOT NULL DEFAULT CURRENT_DATE,
  is_ranking_tournament BOOLEAN DEFAULT TRUE,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  fixed_decks          BOOLEAN DEFAULT FALSE,
  location             TEXT,
  description          TEXT,
  organiser_id         UUID REFERENCES players(id) ON DELETE SET NULL,
  top_cut_size         INT,
  discord_webhook_url  TEXT,
  challonge_id         TEXT,            -- Challonge URL/slug for this tournament
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. MATCHES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'grabbed', 'in_progress', 'logged', 'submitted')),
  ref_id              UUID REFERENCES players(id) ON DELETE SET NULL,
  court_id            UUID,             -- FK added below after courts table
  stage               TEXT,
  winner_id           UUID REFERENCES players(id) ON DELETE SET NULL,
  challonge_match_id  TEXT,             -- Challonge match ID for idempotent re-syncs
  played_at           TIMESTAMPTZ,
  notes               TEXT,
  score1              INT DEFAULT 0,
  score2              INT DEFAULT 0,
  sets_won1           INT DEFAULT 0,
  sets_won2           INT DEFAULT 0,
  current_set         INT DEFAULT 1,
  point_cap           INT DEFAULT 5,
  sets_to_win         INT DEFAULT 2,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. MATCH PLAYERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_players (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sets_won     INT DEFAULT 0,
  total_points INT DEFAULT 0,
  winner       BOOLEAN DEFAULT FALSE,
  UNIQUE (match_id, player_id)
);

-- ── 8. FINISH EVENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finish_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  scorer_player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  finish_type       TEXT NOT NULL CHECK (finish_type IN ('EXT','OVR','BUR','SPN','WRN','PEN')),
  points            INT NOT NULL,
  set_number        INT NOT NULL DEFAULT 1,
  bey_id            UUID,               -- optional link to beyblades
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. PLAYER STATS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           UUID UNIQUE NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  matches_played      INT DEFAULT 0,
  matches_won         INT DEFAULT 0,
  win_rate            FLOAT DEFAULT 0,
  ext_count           INT DEFAULT 0,
  ovr_count           INT DEFAULT 0,
  bur_count           INT DEFAULT 0,
  spn_count           INT DEFAULT 0,
  wrn_count           INT DEFAULT 0,
  pen_count           INT DEFAULT 0,
  tournaments_entered INT DEFAULT 0,
  best_placement      INT,
  swiss_king_total    INT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Add swiss_king_total to existing installs
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS swiss_king_total INT NOT NULL DEFAULT 0;

-- ── 10. PARTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID REFERENCES players(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('blade', 'ratchet', 'bit')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. BEYBLADES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beyblades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID REFERENCES players(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  blade_id    UUID REFERENCES parts(id),
  ratchet_id  UUID REFERENCES parts(id),
  bit_id      UUID REFERENCES parts(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. DECKS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID REFERENCES players(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  bey1_id    UUID REFERENCES beyblades(id),
  bey2_id    UUID REFERENCES beyblades(id),
  bey3_id    UUID REFERENCES beyblades(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. COURTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  current_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Add court FK to matches now that courts table exists
ALTER TABLE matches ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES courts(id) ON DELETE SET NULL;

-- ── 14. TOURNAMENT ENTRANTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_entrants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id           UUID REFERENCES players(id) ON DELETE CASCADE,
  status              TEXT DEFAULT 'registered',
  seed                INTEGER,
  placement           INTEGER,
  points_awarded      INTEGER DEFAULT 0,
  startgg_entrant_id  TEXT,             -- Challonge participant ID
  UNIQUE (tournament_id, player_id)
);

-- ── 15. TOURNAMENT DECKS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_decks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  deck_id       UUID REFERENCES decks(id) ON DELETE CASCADE,
  is_fixed      BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'flagged')),
  declared_at   TIMESTAMPTZ DEFAULT NOW(),
  approved_by   UUID REFERENCES players(id),
  approved_at   TIMESTAMPTZ
);

-- ── 16. BRACKETS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brackets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
  data          JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 17. ACCOUNT CLAIMS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     UUID NOT NULL,
  player_id        UUID REFERENCES players(id) ON DELETE CASCADE,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  discord_username TEXT,
  email            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES players(id)
);

-- ── 18. NOTIFICATIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID REFERENCES players(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 19. PLACEMENT POINTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_points (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_size_min  INTEGER NOT NULL,
  tournament_size_max  INTEGER NOT NULL,
  placement            INTEGER NOT NULL,
  points               INTEGER NOT NULL
);

-- ── 20. POINTS SCALE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_scale (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement  TEXT UNIQUE NOT NULL,
  points     INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 21. SITE CONTENT ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_content (
  id         TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES players(id)
);

-- ── 22. REFEREES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  auth_user_id UUID,
  role         TEXT DEFAULT 'referee',
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 23. MATCH LOGS (legacy — kept for backward compat) ───────
CREATE TABLE IF NOT EXISTS match_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES players(id),
  bey_id      UUID REFERENCES beyblades(id),
  finish_type TEXT NOT NULL,
  points      INT NOT NULL,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 24. MATCH CORRECTIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_corrections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID REFERENCES matches(id) ON DELETE CASCADE,
  corrected_by  UUID REFERENCES players(id),
  original_data JSONB NOT NULL,
  new_data      JSONB NOT NULL,
  reason        TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tournament_entrants_challonge_id
  ON tournament_entrants(tournament_id, startgg_entrant_id);

CREATE INDEX IF NOT EXISTS idx_matches_challonge_match_id
  ON matches(challonge_match_id);

CREATE INDEX IF NOT EXISTS idx_match_players_match
  ON match_players(match_id);

CREATE INDEX IF NOT EXISTS idx_match_players_player
  ON match_players(player_id);

CREATE INDEX IF NOT EXISTS idx_finish_events_match
  ON finish_events(match_id);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_player_stats(p_id UUID) RETURNS VOID AS $$
DECLARE
  v_played  INT := 0;
  v_won     INT := 0;
  v_rate    FLOAT := 0;
  v_ext     INT := 0;
  v_ovr     INT := 0;
  v_bur     INT := 0;
  v_spn     INT := 0;
  v_wrn     INT := 0;
  v_pen     INT := 0;
  v_entered INT := 0;
  v_best    INT := NULL;
BEGIN
  SELECT COUNT(*)::int INTO v_played FROM match_players WHERE player_id = p_id;
  SELECT COUNT(*)::int INTO v_won FROM match_players WHERE player_id = p_id AND winner = true;
  IF v_played > 0 THEN v_rate := ROUND((v_won::float / v_played) * 100, 1); END IF;

  SELECT
    COUNT(*) FILTER (WHERE finish_type = 'EXT')::int,
    COUNT(*) FILTER (WHERE finish_type = 'OVR')::int,
    COUNT(*) FILTER (WHERE finish_type = 'BUR')::int,
    COUNT(*) FILTER (WHERE finish_type = 'SPN')::int,
    COUNT(*) FILTER (WHERE finish_type = 'WRN')::int,
    COUNT(*) FILTER (WHERE finish_type = 'PEN')::int
  INTO v_ext, v_ovr, v_bur, v_spn, v_wrn, v_pen
  FROM finish_events WHERE scorer_player_id = p_id;

  SELECT COUNT(*)::int INTO v_entered FROM tournament_entrants WHERE player_id = p_id;
  SELECT MIN(placement) INTO v_best FROM tournament_entrants WHERE player_id = p_id AND placement IS NOT NULL;

  INSERT INTO player_stats (
    player_id, matches_played, matches_won, win_rate,
    ext_count, ovr_count, bur_count, spn_count, wrn_count, pen_count,
    tournaments_entered, best_placement, updated_at
  ) VALUES (
    p_id,
    COALESCE(v_played,0), COALESCE(v_won,0), COALESCE(v_rate,0),
    COALESCE(v_ext,0), COALESCE(v_ovr,0), COALESCE(v_bur,0),
    COALESCE(v_spn,0), COALESCE(v_wrn,0), COALESCE(v_pen,0),
    COALESCE(v_entered,0), v_best, NOW()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    matches_played      = EXCLUDED.matches_played,
    matches_won         = EXCLUDED.matches_won,
    win_rate            = EXCLUDED.win_rate,
    ext_count           = EXCLUDED.ext_count,
    ovr_count           = EXCLUDED.ovr_count,
    bur_count           = EXCLUDED.bur_count,
    spn_count           = EXCLUDED.spn_count,
    wrn_count           = EXCLUDED.wrn_count,
    pen_count           = EXCLUDED.pen_count,
    tournaments_entered = EXCLUDED.tournaments_entered,
    best_placement      = EXCLUDED.best_placement,
    updated_at          = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: refresh stats when match_players changes
CREATE OR REPLACE FUNCTION trg_fn_refresh_match_player_stats() RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_player_stats(COALESCE(NEW.player_id, OLD.player_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_match_player_stats ON match_players;
CREATE TRIGGER trg_refresh_match_player_stats
  AFTER INSERT OR UPDATE OR DELETE ON match_players
  FOR EACH ROW EXECUTE FUNCTION trg_fn_refresh_match_player_stats();

-- Trigger: refresh stats when a finish_event is logged
CREATE OR REPLACE FUNCTION trg_fn_refresh_finish_stats() RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_player_stats(COALESCE(NEW.scorer_player_id, OLD.scorer_player_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_finish_stats ON finish_events;
CREATE TRIGGER trg_refresh_finish_stats
  AFTER INSERT OR UPDATE OR DELETE ON finish_events
  FOR EACH ROW EXECUTE FUNCTION trg_fn_refresh_finish_stats();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE finish_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entrants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_decks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_claims    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content      ENABLE ROW LEVEL SECURITY;
ALTER TABLE referees          ENABLE ROW LEVEL SECURITY;

-- Public read on most tables
DROP POLICY IF EXISTS "public_read" ON players;           CREATE POLICY "public_read" ON players           FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON teams;             CREATE POLICY "public_read" ON teams             FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON roles;             CREATE POLICY "public_read" ON roles             FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON user_roles;        CREATE POLICY "public_read" ON user_roles        FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON tournaments;       CREATE POLICY "public_read" ON tournaments       FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON matches;           CREATE POLICY "public_read" ON matches           FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON match_players;     CREATE POLICY "public_read" ON match_players     FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON finish_events;     CREATE POLICY "public_read" ON finish_events     FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON player_stats;      CREATE POLICY "public_read" ON player_stats      FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON tournament_entrants; CREATE POLICY "public_read" ON tournament_entrants FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON tournament_decks;  CREATE POLICY "public_read" ON tournament_decks  FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON brackets;          CREATE POLICY "public_read" ON brackets          FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON courts;            CREATE POLICY "public_read" ON courts            FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON site_content;      CREATE POLICY "public_read" ON site_content      FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read" ON referees;          CREATE POLICY "public_read" ON referees          FOR SELECT USING (true);

-- Authenticated write on operational tables
DROP POLICY IF EXISTS "auth_write" ON players;            CREATE POLICY "auth_write" ON players            FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON teams;              CREATE POLICY "auth_write" ON teams              FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON tournaments;        CREATE POLICY "auth_write" ON tournaments        FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON matches;            CREATE POLICY "auth_write" ON matches            FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON match_players;      CREATE POLICY "auth_write" ON match_players      FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON finish_events;      CREATE POLICY "auth_write" ON finish_events      FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON tournament_entrants; CREATE POLICY "auth_write" ON tournament_entrants FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON tournament_decks;   CREATE POLICY "auth_write" ON tournament_decks   FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON brackets;           CREATE POLICY "auth_write" ON brackets           FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON courts;             CREATE POLICY "auth_write" ON courts             FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON notifications;      CREATE POLICY "auth_write" ON notifications      FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_write" ON referees;           CREATE POLICY "auth_write" ON referees           FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Account claims: users can only see/create their own
DROP POLICY IF EXISTS "users_read_own_claims"   ON account_claims;
DROP POLICY IF EXISTS "users_insert_own_claims" ON account_claims;
CREATE POLICY "users_read_own_claims"   ON account_claims FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "users_insert_own_claims" ON account_claims FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA (all idempotent via ON CONFLICT)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO roles (name, description, is_custom, permissions) VALUES
('Player', 'Standard player account', false, '{
  "can_view_rankings":true,"can_view_profiles":true,"can_edit_own_profile":true,
  "can_grab_matches":false,"can_score_matches":false,"can_submit_matches":false,
  "can_create_tournaments":false,"can_complete_tournaments":false,
  "can_manage_refs":false,"can_manage_players":false,"can_manage_roles":false,
  "can_access_admin_panel":false,"can_view_bracket":true,"can_view_meta":true,
  "can_manage_own_parts":true,"can_manage_own_decks":true,
  "can_register_for_tournaments":true,"can_declare_deck":true,
  "can_manage_courts":false,"can_approve_registrations":false,
  "can_approve_decks":false,"can_edit_points_scale":false
}'),
('Referee', 'Tournament official', false, '{
  "can_view_rankings":true,"can_view_profiles":true,"can_edit_own_profile":true,
  "can_grab_matches":true,"can_score_matches":true,"can_submit_matches":true,
  "can_create_tournaments":false,"can_complete_tournaments":false,
  "can_manage_refs":false,"can_manage_players":false,"can_manage_roles":false,
  "can_access_admin_panel":false,"can_view_bracket":true,"can_view_meta":true,
  "can_manage_own_parts":true,"can_manage_own_decks":true,
  "can_register_for_tournaments":true,"can_declare_deck":true,
  "can_manage_courts":false,"can_approve_registrations":false,
  "can_approve_decks":false,"can_edit_points_scale":false
}'),
('Ops', 'Tournament operations', false, '{
  "can_view_rankings":true,"can_view_profiles":true,"can_edit_own_profile":true,
  "can_grab_matches":true,"can_score_matches":true,"can_submit_matches":true,
  "can_create_tournaments":true,"can_complete_tournaments":true,
  "can_manage_refs":true,"can_manage_players":true,"can_manage_roles":false,
  "can_access_admin_panel":false,"can_view_bracket":true,"can_view_meta":true,
  "can_manage_own_parts":true,"can_manage_own_decks":true,
  "can_register_for_tournaments":true,"can_declare_deck":true,
  "can_manage_courts":true,"can_approve_registrations":true,
  "can_approve_decks":true,"can_edit_points_scale":false
}'),
('Team Captain', 'Can manage their own team roster', false, '{
  "can_view_rankings":true,"can_view_profiles":true,"can_edit_own_profile":true,
  "can_grab_matches":false,"can_score_matches":false,"can_submit_matches":false,
  "can_create_tournaments":false,"can_complete_tournaments":false,
  "can_manage_refs":false,"can_manage_players":false,"can_manage_roles":false,
  "can_access_admin_panel":false,"can_view_bracket":true,"can_view_meta":true,
  "can_manage_own_parts":true,"can_manage_own_decks":true,
  "can_register_for_tournaments":true,"can_declare_deck":true,
  "can_manage_courts":false,"can_approve_registrations":false,
  "can_approve_decks":false,"can_edit_points_scale":false,
  "can_manage_own_team":true
}'),
('Admin', 'Full system access', false, '{
  "can_view_rankings":true,"can_view_profiles":true,"can_edit_own_profile":true,
  "can_grab_matches":true,"can_score_matches":true,"can_submit_matches":true,
  "can_create_tournaments":true,"can_complete_tournaments":true,
  "can_manage_refs":true,"can_manage_players":true,"can_manage_roles":true,
  "can_access_admin_panel":true,"can_view_bracket":true,"can_view_meta":true,
  "can_manage_own_parts":true,"can_manage_own_decks":true,
  "can_register_for_tournaments":true,"can_declare_deck":true,
  "can_manage_courts":true,"can_approve_registrations":true,
  "can_approve_decks":true,"can_edit_points_scale":true
}')
ON CONFLICT (name) DO NOTHING;

INSERT INTO points_scale (placement, points) VALUES
('1st', 12), ('2nd', 8), ('3rd', 6), ('4th', 4), ('5th-8th', 3), ('Outside top 8', 1)
ON CONFLICT (placement) DO NOTHING;

INSERT INTO placement_points (tournament_size_min, tournament_size_max, placement, points) VALUES
(8,16,1,100),(8,16,2,75),(8,16,3,50),(8,16,4,25),
(17,32,1,200),(17,32,2,150),(17,32,3,100),(17,32,4,75),
(17,32,5,50),(17,32,6,50),(17,32,7,50),(17,32,8,50),
(33,64,1,400),(33,64,2,300),(33,64,3,200),(33,64,4,150),
(33,64,5,100),(33,64,6,100),(33,64,7,100),(33,64,8,100)
ON CONFLICT DO NOTHING;

INSERT INTO site_content (id, content) VALUES
('home.hero.headline',              'The home of competitive Beyblade X'),
('home.hero.subtitle',              'Tournament management, live match scoring, and global rankings — all in one place.'),
('home.features.tournament.title',  'Tournament Engine'),
('home.features.tournament.body',   'Swiss, Round Robin, Single & Double Elimination. Auto-seeding by ranking.'),
('home.features.scoring.title',     'Live Scoring'),
('home.features.scoring.body',      'Referees grab and score matches in real-time. Every EXT, OVR, BUR, SPN finish logged per beyblade.'),
('home.features.rankings.title',    'Global Rankings'),
('home.features.rankings.body',     'Points awarded automatically on tournament completion. Head-to-head records and meta stats per part.')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- GRANTS (Supabase requires explicit grants after RLS is enabled)
-- ═══════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
