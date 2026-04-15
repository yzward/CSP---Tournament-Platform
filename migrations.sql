-- ============================================================
-- ClashStatsPro — Migrations
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- All CREATE/ALTER statements are idempotent — safe to re-run
-- ============================================================

-- Tournament optional columns (added in April 2026 expansion)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organiser_id UUID REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS top_cut_size INT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;

-- Teams expansion
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE tournament_entrants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registered';
ALTER TABLE tournament_entrants ADD COLUMN IF NOT EXISTS seed INTEGER;

-- RLS for teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_teams" ON teams;
CREATE POLICY "public_read_teams" ON teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "authenticated_write_teams" ON teams;
CREATE POLICY "authenticated_write_teams" ON teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- player_stats — refresh function + triggers
-- Real schema (confirmed):
--   matches:        id, tournament_id, status, ref_id, stage, court_id, ...
--   match_players:  id, match_id, player_id, sets_won, total_points, winner (bool)
--   finish_events:  id, match_id, scorer_player_id, finish_type, points, set_number, bey_id
--   player_stats:   id, player_id, matches_played, matches_won, win_rate,
--                   ext_count, ovr_count, bur_count, spn_count, wrn_count, pen_count,
--                   tournaments_entered, best_placement, updated_at
-- ============================================================

-- Function: recalculate all stats for one player
CREATE OR REPLACE FUNCTION refresh_player_stats(p_id UUID) RETURNS VOID AS $$
DECLARE
  v_played   INT := 0;
  v_won      INT := 0;
  v_rate     FLOAT := 0;
  v_ext      INT := 0;
  v_ovr      INT := 0;
  v_bur      INT := 0;
  v_spn      INT := 0;
  v_wrn      INT := 0;
  v_pen      INT := 0;
  v_entered  INT := 0;
  v_best     INT := NULL;
BEGIN
  -- Matches played (any row in match_players for this player)
  SELECT COUNT(*)::int INTO v_played
    FROM match_players mp WHERE mp.player_id = p_id;

  -- Matches won
  SELECT COUNT(*)::int INTO v_won
    FROM match_players mp WHERE mp.player_id = p_id AND mp.winner = true;

  -- Win rate
  IF v_played > 0 THEN
    v_rate := ROUND((v_won::float / v_played) * 100, 1);
  END IF;

  -- Finish type counts from finish_events
  SELECT
    COUNT(*) FILTER (WHERE fe.finish_type = 'EXT')::int,
    COUNT(*) FILTER (WHERE fe.finish_type = 'OVR')::int,
    COUNT(*) FILTER (WHERE fe.finish_type = 'BUR')::int,
    COUNT(*) FILTER (WHERE fe.finish_type = 'SPN')::int,
    COUNT(*) FILTER (WHERE fe.finish_type = 'WRN')::int,
    COUNT(*) FILTER (WHERE fe.finish_type = 'PEN')::int
  INTO v_ext, v_ovr, v_bur, v_spn, v_wrn, v_pen
  FROM finish_events fe WHERE fe.scorer_player_id = p_id;

  -- Tournaments entered
  SELECT COUNT(*)::int INTO v_entered
    FROM tournament_entrants te WHERE te.player_id = p_id;

  -- Best placement (lowest number = best)
  SELECT MIN(te.placement) INTO v_best
    FROM tournament_entrants te WHERE te.player_id = p_id AND te.placement IS NOT NULL;

  INSERT INTO player_stats (
    player_id, matches_played, matches_won, win_rate,
    ext_count, ovr_count, bur_count, spn_count, wrn_count, pen_count,
    tournaments_entered, best_placement, updated_at
  ) VALUES (
    p_id,
    COALESCE(v_played, 0), COALESCE(v_won, 0), COALESCE(v_rate, 0),
    COALESCE(v_ext, 0), COALESCE(v_ovr, 0), COALESCE(v_bur, 0),
    COALESCE(v_spn, 0), COALESCE(v_wrn, 0), COALESCE(v_pen, 0),
    COALESCE(v_entered, 0), v_best, NOW()
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

-- Trigger: refresh player stats when a match_players row changes
-- (covers match completion — when winner is set)
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

-- Trigger: refresh player stats when a finish_event is logged
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

-- ============================================================
-- Match state columns (added for scorer v2)
-- These track current-set scores + set counts for live display
-- and spectators. finish_events remains the event log.
-- ============================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score1      INT DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score2      INT DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sets_won1   INT DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sets_won2   INT DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_set INT DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS point_cap   INT DEFAULT 5;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sets_to_win INT DEFAULT 2;

-- Unique constraint on brackets.tournament_id (needed for upsert / regeneration)
ALTER TABLE brackets ADD CONSTRAINT brackets_tournament_id_unique UNIQUE (tournament_id);

-- RLS policies for all tables used in match/bracket workflow
DROP POLICY IF EXISTS "authenticated_write_tournament_entrants" ON tournament_entrants;
CREATE POLICY "authenticated_write_tournament_entrants" ON tournament_entrants FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_brackets" ON brackets;
CREATE POLICY "public_read_brackets" ON brackets FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated_write_brackets" ON brackets;
CREATE POLICY "authenticated_write_brackets" ON brackets FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_write_courts" ON courts;
CREATE POLICY "authenticated_write_courts" ON courts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_write_matches" ON matches;
CREATE POLICY "authenticated_write_matches" ON matches FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_write_match_players" ON match_players;
CREATE POLICY "authenticated_write_match_players" ON match_players FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_write_finish_events" ON finish_events;
CREATE POLICY "authenticated_write_finish_events" ON finish_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill: recalculate stats for all existing players
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM players LOOP
    PERFORM refresh_player_stats(r.id);
  END LOOP;
END $$;

-- ============================================================
-- site_content — editable site text
-- ============================================================
CREATE TABLE IF NOT EXISTS site_content (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES players(id)
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_site_content" ON site_content;
CREATE POLICY "public_read_site_content" ON site_content FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_write_site_content" ON site_content;
CREATE POLICY "admin_write_site_content" ON site_content FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.player_id = (SELECT id FROM players WHERE discord_id = auth.uid()::text)
    AND r.name = 'Admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.player_id = (SELECT id FROM players WHERE discord_id = auth.uid()::text)
    AND r.name = 'Admin'
  )
);

INSERT INTO site_content (id, content) VALUES
('home.hero.headline', 'The home of competitive Beyblade X'),
('home.hero.subtitle', 'Tournament management, live match scoring, and global rankings — all in one place. Built for the Spirit Gaming Beyblade X community.'),
('home.features.tournament.title', 'Tournament Engine'),
('home.features.tournament.body', 'Swiss, Round Robin, Single & Double Elimination. Auto-seeding by ranking. Bracket preview before you generate.'),
('home.features.scoring.title', 'Live Scoring'),
('home.features.scoring.body', 'Referees grab and score matches in real-time. Every EXT, OVR, BUR, SPN finish logged per beyblade.'),
('home.features.rankings.title', 'Global Rankings'),
('home.features.rankings.body', 'Points awarded automatically on tournament completion. Head-to-head records and meta stats per part.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- account_claims — profile claiming system
-- ============================================================
CREATE TABLE IF NOT EXISTS account_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL, -- References auth.users(id)
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  discord_username TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE account_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_claims" ON account_claims;
CREATE POLICY "users_read_own_claims" ON account_claims FOR SELECT USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_claims" ON account_claims;
CREATE POLICY "users_insert_own_claims" ON account_claims FOR INSERT WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_all_claims" ON account_claims;
CREATE POLICY "admins_read_all_claims" ON account_claims FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.player_id = (SELECT id FROM players WHERE discord_id = auth.uid()::text)
    AND r.name = 'Admin'
  )
);

DROP POLICY IF EXISTS "admins_update_claims" ON account_claims;
CREATE POLICY "admins_update_claims" ON account_claims FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.player_id = (SELECT id FROM players WHERE discord_id = auth.uid()::text)
    AND r.name = 'Admin'
  )
);
