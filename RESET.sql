-- ============================================================
-- ClashStatsPro — Full Database Reset
-- ⚠️  THIS WIPES ALL DATA. Run SETUP.sql immediately after.
-- ============================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_refresh_match_player_stats ON match_players;
DROP TRIGGER IF EXISTS trg_refresh_finish_stats ON finish_events;

-- Drop functions
DROP FUNCTION IF EXISTS refresh_player_stats(UUID);
DROP FUNCTION IF EXISTS trg_fn_refresh_match_player_stats();
DROP FUNCTION IF EXISTS trg_fn_refresh_finish_stats();
DROP FUNCTION IF EXISTS award_tournament_points(UUID);

-- Drop all tables (CASCADE handles FK dependencies automatically)
DROP TABLE IF EXISTS match_corrections      CASCADE;
DROP TABLE IF EXISTS match_logs             CASCADE;
DROP TABLE IF EXISTS finish_events          CASCADE;
DROP TABLE IF EXISTS match_players          CASCADE;
DROP TABLE IF EXISTS matches                CASCADE;
DROP TABLE IF EXISTS courts                 CASCADE;
DROP TABLE IF EXISTS brackets               CASCADE;
DROP TABLE IF EXISTS tournament_decks       CASCADE;
DROP TABLE IF EXISTS tournament_entrants    CASCADE;
DROP TABLE IF EXISTS player_stats           CASCADE;
DROP TABLE IF EXISTS placement_points       CASCADE;
DROP TABLE IF EXISTS points_scale           CASCADE;
DROP TABLE IF EXISTS notifications          CASCADE;
DROP TABLE IF EXISTS account_claims         CASCADE;
DROP TABLE IF EXISTS site_content           CASCADE;
DROP TABLE IF EXISTS referees               CASCADE;
DROP TABLE IF EXISTS decks                  CASCADE;
DROP TABLE IF EXISTS beyblades              CASCADE;
DROP TABLE IF EXISTS parts                  CASCADE;
DROP TABLE IF EXISTS tournaments            CASCADE;
DROP TABLE IF EXISTS user_roles             CASCADE;
DROP TABLE IF EXISTS roles                  CASCADE;
DROP TABLE IF EXISTS players                CASCADE;
DROP TABLE IF EXISTS teams                  CASCADE;
