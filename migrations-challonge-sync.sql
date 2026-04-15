-- ============================================================
-- ClashStatsPro — Challonge Sync Columns
-- Run in Supabase SQL Editor BEFORE using the sync feature.
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- 1. Link a tournament to a Challonge tournament by URL or slug
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS evaroon_id TEXT;

-- 2. Track which Challonge participant ID maps to each entrant
--    (replaces the old hack of storing Challonge IDs in players.discord_id)
ALTER TABLE tournament_entrants ADD COLUMN IF NOT EXISTS startgg_entrant_id TEXT;

-- 3. Track which Challonge match ID maps to each local match
--    (enables idempotent re-syncs without duplicating matches)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS evaroon_match_id TEXT;

-- 4. Make discord_id nullable so Challonge-imported players don't need Discord IDs.
--    Players who sign in via Discord will still have this field populated by auth.
ALTER TABLE players ALTER COLUMN discord_id DROP NOT NULL;

-- 5. Index for fast participant lookup during sync
CREATE INDEX IF NOT EXISTS idx_tournament_entrants_challonge_id
  ON tournament_entrants(tournament_id, startgg_entrant_id);

-- 6. Index for fast match lookup during sync
CREATE INDEX IF NOT EXISTS idx_matches_evaroon_match_id
  ON matches(evaroon_match_id);
