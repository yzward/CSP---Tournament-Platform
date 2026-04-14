# ClashStatsPro — Project Context

> This file is the canonical AI handoff document. Keep it up to date when adding major features, changing architecture, or modifying DB schema. It is designed to be readable by Claude, AI Studio, or any LLM-assisted editor.

---

## Live URLs

- **App:** https://play.clash.co.nz
- **GitHub:** https://github.com/yzward/clashstatspro

---

## What This Is

**ClashStatsPro** is a full-stack tournament management platform built for competitive Beyblade X events. It handles player registration, bracket generation, live match scoring, ranking points, and public result viewing. The long-term goal is to allow external tournament organisers to use the platform for their own events.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.3 (App Router, Turbopack) |
| Auth | Supabase Auth + Discord OAuth |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase channel subscriptions (client-side only) |
| UI | Tailwind CSS + shadcn/ui primitives, Framer Motion (`motion/react`) |
| Bracket Engine | `brackets-manager` + `brackets-viewer` libraries |
| Hosting | Vercel Hobby plan |
| AI Tooling | Google AI Studio (Gemini) for code edits; Claude Code for architecture/migrations |

**Vercel Hobby constraints (must respect):**
- No Vercel Cron jobs
- No streaming / SSE — all realtime is Supabase client subscriptions
- API routes must stay under 60s
- No Edge Runtime functions (use default Node.js serverless)

---

## Auth Flow

1. User clicks "Login with Discord" → Discord OAuth
2. `app/auth/callback/route.ts` exchanges code, verifies Discord guild membership, sets Supabase session
3. On success: redirects to `/` by default; Admins → `/admin`, Ops → `/operations`, Refs → `/referee`
4. `proxy.ts` (Next.js 16 middleware — export named `proxy`, NOT `middleware`) protects all routes except public paths
5. Roles stored in `user_roles` table joined with `roles` table; **no `referees` table exists** — do not reference it

**Public paths (no auth required):**
`/login`, `/auth/*`, `/pending`, `/results/*`, `/tournaments/*`, `/meta`, `/matches/*`

---

## Database Schema

### Core Tables (confirmed real schema — live database)

```
players             — id (uuid), discord_id (text), username, display_name, avatar_url,
                      region, club, ranking_points (int, default 0), status
                      NOTE: discord_id stores the Supabase auth user.id (not the Discord snowflake)

roles               — id, name, permissions (JSONB), is_custom
                      Values: 'Player', 'Referee', 'Temp Referee', 'Ops', 'Admin'

user_roles          — player_id → players(id), role_id → roles(id)

tournaments         — id, name, stage_type ('single'|'two_stage'), stage1_format, stage2_format,
                      held_at (DATE — *** NOT "date" — column is held_at ***),
                      format (text, set to stage1_format value on insert),
                      is_ranking_tournament (bool), status ('active'|'completed'), fixed_decks (bool),
                      location (text, nullable), description (text, nullable),
                      discord_webhook_url (text, nullable), organiser_id (uuid → players, nullable),
                      top_cut_size (int, nullable — only set for two_stage tournaments)
                      ⚠️ CRITICAL: .order('date') FAILS SILENTLY — always use .order('held_at')

matches             — id, tournament_id, status ('pending'|'grabbed'|'in_progress'|'logged'|'submitted'),
                      ref_id (uuid → players, nullable — *** NOT referee_id ***),
                      court_id (uuid → courts, nullable), winner_id (uuid → players, nullable),
                      stage (text, nullable — e.g. "Round 1"), 
                      point_cap (int, default 5), sets_to_win (int, default 2),
                      score1, score2, sets_won1, sets_won2, current_set
                      NOTE: player identity is via match_players join, NOT player1_id/player2_id columns

match_players       — id, match_id → matches(id), player_id → players(id),
                      sets_won (int), total_points (int), winner (bool)
                      Rows: one per player per match (always 2 rows). mps[0] = P1, mps[1] = P2.
                      ⚠️ PostgREST nested join (match_players(..., players(...))) may not resolve
                         if FK is missing. Use separate query + client-side merge if join returns null.

finish_events       — id, match_id, scorer_player_id (uuid → players), finish_type (text),
                      points (int), created_at
                      NOTE: this is the live scoring event log, NOT match_logs

player_stats        — id, player_id (uuid → players), matches_played, matches_won, win_rate,
                      ext_count, ovr_count, bur_count, spn_count, wrn_count, pen_count,
                      tournaments_entered, best_placement, updated_at
                      NOTE: auto-refreshed by DB triggers on match_players and finish_events inserts

tournament_entrants — id, tournament_id, player_id, placement (int, nullable), points_awarded (int)

brackets            — id, tournament_id UNIQUE, data (JSONB), updated_at
                      data contains: { stage: [], match: [], match_game: [], participant: [] }
                      (brackets-manager stageData format)

notifications       — id, player_id, type, message, link, read
courts              — id, tournament_id, name, current_match_id
account_claims      — id, auth_user_id, player_id, status, discord_username
placement_points    — tournament_size_min, tournament_size_max, placement, points
points_scale        — placement, points
parts               — id, player_id, name, type ('blade'|'ratchet'|'bit')
beyblades           — id, player_id, name, blade_id, ratchet_id, bit_id
decks               — id, player_id, name, bey1_id, bey2_id, bey3_id
tournament_decks    — id, tournament_id, player_id, deck_id, is_fixed, status
```

### RLS Policies (confirmed applied)

```
players:            public SELECT; authenticated UPDATE (own row)
player_stats:       public SELECT; authenticated ALL
tournaments:        public SELECT; authenticated INSERT/UPDATE
brackets:           public SELECT; authenticated ALL
tournament_entrants: authenticated ALL
matches:            authenticated ALL (FOR ALL TO authenticated USING (true))
match_players:      public SELECT (USING true); authenticated ALL
finish_events:      authenticated ALL
courts:             authenticated ALL
```

If getting 406/permission errors, add via Supabase Dashboard → Table Editor → RLS:
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name FOR SELECT USING (true);
```

### Beyblade Format

- **3on3** — each player brings a deck of 3 beyblades
- Each beyblade: **Blade + Ratchet + Bit**
- No repeating parts across the 3 beyblades in a deck
- Fixed decks can be enabled per stage (`fixed_decks` column on tournaments)

### Ranking Points Scale

| Placement | Points |
|-----------|--------|
| 1st | 12 |
| 2nd | 8 |
| 3rd | 6 |
| 4th | 4 |
| 5th–8th | 3 |
| Outside top 8 | 1 |

Stored in `points_scale` table. Awarded on tournament completion via `POST /api/tournaments/[id]` with `{ action: 'complete', placements: [...] }`.

### Finish Types & Points

| Code | Name | Points | Notes |
|------|------|--------|-------|
| EXT | Extreme Finish | 3 | |
| OVR | Over Finish | 2 | |
| BUR | Burst Finish | 2 | |
| SPN | Spin Finish | 1 | |
| WRN | Warning | 0 | |
| PEN | Penalty | 1 | scorer_player_id = FOULING player; opponent receives the point |

**PEN logic:** `scorer_player_id` = the player whose button was tapped (fouling player, for stats). `buildState()` awards the point to the opponent. Intentional — tracks who fouled while correctly scoring.

---

## Directory Structure

```
app/
  page.tsx                              Landing page (public)
  login/                                Discord OAuth login
  auth/callback/                        OAuth callback + guild check + role redirect
  claim/                                Account claim for existing players
  pending/                              Awaiting approval
  not-authorised/                       Access denied
  rankings/                             Global leaderboard
  players/[username]/                   Player profile — stats, collection, settings
  tournaments/                          PUBLIC — tournament discovery hub
  tournaments/[id]/                     PUBLIC — tournament detail + standings
  tournaments/[id]/bracket/             PUBLIC — bracket viewer (realtime, brackets-viewer)
  meta/                                 PUBLIC — meta stats (finish types, top beyblades)
  matches/[matchId]/live/               PUBLIC — live spectator view (realtime)
  scorer/[matchId]/                     Referee live scorer
  referee/                              Referee dashboard (grab matches queue)
  results/[id]/                         PUBLIC — shareable tournament results
  operations/                           Ops dashboard (assignments, courts, tournament mgmt)
  operations/tournaments/               Create tournament form
  operations/tournaments/[id]/bracket/  Manage bracket — add/remove players, generate
  operations/tournaments/[id]/edit/     Edit tournament details
  admin/                                Admin panel — players, roles, points scale
  api/
    auth/                               Discord OAuth + Supabase callback
    tournaments/[id]/route.ts           POST: complete tournament; DELETE: delete tournament
    tournaments/[id]/generate/route.ts  POST: generate bracket (brackets-manager, saves JSON + creates matches)
    discord/webhook/route.ts            POST: send Discord embed for match result (fire-and-forget)
    public/[...path]/                   GET: public read-only endpoints

lib/
  supabase.ts          getSupabase() → browser client; getSupabaseAdmin() → service role
  notifications.ts     createNotification, notifyAdmins, notifyRefs

components/
  BracketViewer.tsx    Fetches brackets.data, renders via brackets-viewer (realtime)
  CollectionManager.tsx  Parts / beyblades / decks CRUD
  Navbar.tsx           Role-based navigation
  NotificationBell.tsx Realtime notification dropdown

proxy.ts              Next.js 16 middleware — export named `proxy` (NOT `middleware`)
migrations.sql        All DB migrations (idempotent, safe to re-run)
supabase-schema.sql   Original schema reference (may be outdated — trust migrations.sql + this file)
types.ts              TypeScript interfaces
```

---

## Key Patterns

### Supabase Client Usage

- **Client components**: `import { getSupabase } from '@/lib/supabase'`
- **Server/API routes**: `import { getSupabaseAdmin } from '@/lib/supabase'` (bypasses RLS)
- Cast to `(supabase as any)` when querying tables not in generated types

### Fetching Player Names in Match Lists

The PostgREST nested join `match_players(..., players(id, display_name))` may silently return null if the FK isn't fully registered. **Reliable pattern used in operations/referee pages:**

```ts
// Step 1: fetch matches with match_players (no nested player join)
const { data: matchesData } = await supabase
  .from('matches')
  .select('*, match_players(*)')
  .order('created_at', { ascending: false });

// Step 2: collect all player IDs
const playerIds = new Set<string>();
for (const m of matchesData || []) {
  for (const mp of m.match_players || []) {
    if (mp.player_id) playerIds.add(mp.player_id);
  }
}

// Step 3: fetch players
const playerMap: Record<string, any> = {};
if (playerIds.size > 0) {
  const { data: playersData } = await supabase
    .from('players').select('id, display_name, avatar_url')
    .in('id', Array.from(playerIds));
  for (const p of playersData || []) playerMap[p.id] = p;
}

// Step 4: merge
const enrichedMatches = (matchesData || []).map((m: any) => ({
  ...m,
  match_players: (m.match_players || []).map((mp: any) => ({
    ...mp,
    players: playerMap[mp.player_id] || null,
  }))
}));
```

The scorer page uses `match_players(*, players(*))` and works because it fetches a single match by ID as an authenticated user who is in that match. For bulk match queries across all tournaments, use the two-step pattern above.

### Scorer v2 — buildState() Pattern

The scorer replays all `finish_events` to derive current state. Undo = delete last event + re-run.

```ts
function buildState(events: any[], p1Id: string, pointCap: number, setsToWin: number) {
  let score1 = 0, score2 = 0, setsWon1 = 0, setsWon2 = 0, currentSet = 1;
  for (const ev of events) {
    const pts = ev.points ?? 0;
    const isPen = ev.finish_type === 'PEN';
    const p1Scored = ev.scorer_player_id === p1Id;
    if (isPen) { if (p1Scored) score2 += pts; else score1 += pts; }
    else       { if (p1Scored) score1 += pts; else score2 += pts; }
    if (score1 >= pointCap) { setsWon1++; score1 = 0; score2 = 0; currentSet++; }
    else if (score2 >= pointCap) { setsWon2++; score1 = 0; score2 = 0; currentSet++; }
  }
  return { score1, score2, setsWon1, setsWon2, currentSet, matchDone: setsWon1 >= setsToWin || setsWon2 >= setsToWin };
}
```

Same function in scorer page and live spectator view — keep in sync.

### Bracket Generation (`POST /api/tournaments/[id]/generate`)

1. Fetch `tournament_entrants` sorted by `players(ranking_points)` desc
2. Map entrants to `participants[]` with `{ id: player_uuid, name: display_name }`
3. For **elimination**: pad seeding to next power-of-2 with null byes; set `balanceByes: true`
4. For **round_robin**: use exact participant count; set `groupCount: 1`; no padding
5. Run `BracketsManager.create.stage()` with `InMemoryDatabase`
6. Export via `manager.get.stageData(0)` → save JSON to `brackets` table
7. Build `participantMap` by matching exported `participant[].name` back to player UUID (do NOT assume position index = internal ID)
8. Filter `exportedData.match` where `opponent1.id != null && opponent2.id != null` → create `matches` + `match_players` rows
9. Redirect to `/tournaments/[id]/bracket`

Format mapping:
```ts
{ single_elim: 'single_elimination', double_elim: 'double_elimination', round_robin: 'round_robin', swiss: 'round_robin' }
```

### Referee Assignment

Column is `ref_id` (UUID, FK → players). Always coerce empty string to null:
```ts
const refValue = refId || null;
.update({ ref_id: refValue, status: refValue ? 'grabbed' : 'pending' })
```

### Tournament Completion

1. Ops clicks "Complete" → `POST /api/tournaments/{id}` with `{ action: 'complete', placements: [{player_id, placement}] }`
2. API updates `tournament_entrants.placement`, updates `players.ranking_points`, fires Discord notification
3. Tournament `status` → `'completed'`

### Discord Webhook (per tournament)

Set `discord_webhook_url` on tournament. After each match submit in scorer, fires `POST /api/discord/webhook` — fire-and-forget. Formats a Discord embed with match result.

### Role Detection

Exclusively via `user_roles` JOIN `roles`. No `referees` table.

```ts
const { data: rolesData } = await supabase
  .from('user_roles').select('roles!inner(name)').eq('player_id', playerId)
const roleNames = rolesData.map(r => r.roles?.name)
// roleNames.includes('Admin' | 'Ops' | 'Referee' | 'Temp Referee')
```

---

## Migrations Applied (as of April 2026)

All in `migrations.sql` — idempotent, run in Supabase SQL Editor.

- `tournaments`: `location`, `description`, `discord_webhook_url`, `organiser_id`, `held_at` (if needed), `top_cut_size`
- `matches`: `score1`, `score2`, `sets_won1`, `sets_won2`, `current_set`, `point_cap`, `sets_to_win`, `ref_id` (was `referee_id`), `stage`, `court_id`
- `brackets`: UNIQUE constraint on `tournament_id`
- `refresh_player_stats(player_id)` function + triggers on `match_players` and `finish_events`
- FK constraints: `match_players.player_id → players.id`, `match_players.match_id → matches.id`
- RLS policies: see list above

---

## Gemini / AI Editor Warnings

- **Gemini creates empty stray files** (e.g. `proxy.ts`, `route.ts`, `app/admin/route.ts`) that cause Vercel build failures ("conflicting route" / "both middleware and proxy detected"). Check for empty `.ts` files when diagnosing build errors.
- **`vercel.json` must NOT exist** — a SPA rewrite rule `"destination": "/index.html"` causes all pages to 404 on Vercel. Delete it if it reappears.
- **Next.js 16 middleware**: file must be `proxy.ts`, export must be named `proxy` (not `middleware`).

---

## Historical Data

75 players imported from clash.co.nz (old SportPress WordPress site) with `display_name`, `username`, `club`, `region`, `ranking_points`. All `player_stats` counts start at 0 — correct and expected. Stats populate as matches are scored.

---

## Current Status (April 2026)

**Working:**
- Discord OAuth login + guild membership check
- Rankings page (75 players with ranking_points)
- Player profiles at `/players/[username]`
- Operations dashboard — match assignments, courts, auto-rank, complete tournament
- Bracket management — add/remove players, seed by ranking, generate bracket
- Bracket generation — single elim, double elim, Swiss/round-robin (all formats)
- Public bracket viewer at `/tournaments/[id]/bracket` (brackets-viewer library, realtime)
- Edit tournament page at `/operations/tournaments/[id]/edit`
- Delete tournament (bracket page + ops dashboard)
- Scorer v2 at `/scorer/[matchId]` — set/match state machine, PEN tracking, undo
- Live spectator view at `/matches/[matchId]/live`
- Meta stats page at `/meta`
- Tournaments hub at `/tournaments`
- Admin dashboard — account claims, player management, points scale
- Role-based navbar

**Known Issues / Active TODOs:**

1. **Player names show UNKNOWN** in operations live assignments and referee queue — `match_players` to `players` join not resolving; needs two-step fetch pattern (see Key Patterns above)
2. **Referee assignment FK error** — `ref_id` update fails if empty string passed; fix: coerce `''` to `null`
3. Tournament history on player profile: blank dates — check column name `held_at` vs `date` in query
4. After generating a bracket, ops dashboard needs page refresh to show new matches
5. Swiss round generation: all rounds generated upfront; ideally round N+1 should only unlock when round N is complete

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://play.clash.co.nz
NEXT_PUBLIC_DISCORD_GUILD_ID=1311180569773867020
```
