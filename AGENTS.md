# Project Conventions: Challonge Synchronization

## Tournament Status
- Referees only see matches for tournaments with `status = 'active'`.
- New tournaments imported from Challonge are set to `active` by default, but manually created ones might be `pending`.
- Use the status toggle on the Tournament Dashboard to manage this.

## Match Synchronization
- The `sync-tournament` API pulls matches from Challonge and maps them to local players.
- Mapping is done via `tournament_entrants.startgg_entrant_id`, which stores the Challonge Participant ID.
- If matches are not appearing:
  1. Check if the tournament is `active`.
  2. Check if participants have been synced (use "Sync In" or "Manage Entrants").
  3. Check the server logs for `[Sync]` prefix to see if matches are being skipped or if mapping is failing.

## Real-time Updates
- Dashboards use Supabase real-time subscriptions to update when `matches`, `match_players`, or `tournament_entrants` change.
- A manual "Refresh" button is provided as a fallback.
