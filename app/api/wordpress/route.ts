import { NextResponse } from 'next/server';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;

const getWpAuthHeader = () => {
  if (!WP_USER || !WP_PASS) return null;
  return `Basic ${Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64")}`;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const id = searchParams.get('id');

  if (!WP_URL) return NextResponse.json({ error: "WORDPRESS_URL is not configured." }, { status: 500 });
  const authHeader = getWpAuthHeader();
  if (!authHeader) return NextResponse.json({ error: "WordPress credentials are not configured." }, { status: 500 });

  const baseUrl = WP_URL.endsWith('/') ? WP_URL.slice(0, -1) : WP_URL;

  try {
    if (action === 'players') {
      const response = await fetch(`${baseUrl}/wp-json/sportspress/v2/players?per_page=100`, {
        headers: { Authorization: authHeader },
      });
      const players = await response.json();
      if (!Array.isArray(players)) return NextResponse.json([]);
      return NextResponse.json(players.map((p: any) => ({ id: p.id, name: p.title.rendered, slug: p.slug })));
    }

    if (action === 'tables') {
      const response = await fetch(`${baseUrl}/wp-json/sportspress/v2/tables?per_page=100`, {
        headers: { Authorization: authHeader },
      });
      const tables = await response.json();
      if (!Array.isArray(tables)) return NextResponse.json([]);
      return NextResponse.json(tables.map((t: any) => {
        let rawData = t.sp_data || t.data || t.sp_table_data || t.table_data || {};
        if (typeof rawData === 'string') { try { rawData = JSON.parse(rawData); } catch (e) {} }
        let tableData = rawData;
        if (rawData && typeof rawData === 'object') {
          if (rawData.rows && typeof rawData.rows === 'object') tableData = rawData.rows;
          else if (rawData.data && typeof rawData.data === 'object' && !Array.isArray(rawData.data)) tableData = rawData.data;
        }
        return { id: t.id, name: t.title.rendered, data: tableData };
      }));
    }

    if (action === 'leagues') {
      const response = await fetch(`${baseUrl}/wp-json/wp/v2/sp_league?per_page=100`, {
        headers: { Authorization: authHeader },
      });
      return NextResponse.json(await response.json());
    }

    if (action === 'seasons') {
      const response = await fetch(`${baseUrl}/wp-json/wp/v2/sp_season?per_page=100`, {
        headers: { Authorization: authHeader },
      });
      return NextResponse.json(await response.json());
    }

    if (action === 'player-lists') {
      if (id) {
        const response = await fetch(`${baseUrl}/wp-json/sportspress/v2/lists/${id}`, {
          headers: { Authorization: authHeader },
        });
        const list = await response.json();
        let rawData = list.sp_data || list.data || list.sp_list_data || list.list_data || {};
        if (typeof rawData === 'string') { try { rawData = JSON.parse(rawData); } catch (e) {} }
        let listData = rawData;
        if (rawData && typeof rawData === 'object') {
          if (rawData.rows && typeof rawData.rows === 'object') listData = rawData.rows;
          else if (rawData.data && typeof rawData.data === 'object' && !Array.isArray(rawData.data)) listData = rawData.data;
        }
        return NextResponse.json({ id: list.id, name: list.title?.rendered || "Player List", data: listData });
      } else {
        const response = await fetch(`${baseUrl}/wp-json/sportspress/v2/lists?per_page=100`, {
          headers: { Authorization: authHeader },
        });
        return NextResponse.json(await response.json());
      }
    }

    if (action === 'events') {
      const response = await fetch(`${baseUrl}/wp-json/sportspress/v2/events?per_page=100&orderby=date&order=desc`, {
        headers: { Authorization: authHeader },
      });
      const events = await response.json();
      if (!Array.isArray(events)) return NextResponse.json([]);
      return NextResponse.json(events.map((e: any) => ({ id: e.id, name: e.title.rendered, date: e.date })));
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!WP_URL) return NextResponse.json({ error: "WORDPRESS_URL is not configured." }, { status: 500 });
  const authHeader = getWpAuthHeader();
  if (!authHeader) return NextResponse.json({ error: "WordPress credentials are not configured." }, { status: 500 });

  const baseUrl = WP_URL.endsWith('/') ? WP_URL.slice(0, -1) : WP_URL;
  const body = await request.json();

  try {
    if (action === 'players') {
      const { name } = body;
      const response = await fetch(`${baseUrl}/wp-json/sportspress/v2/players`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ title: name, status: "publish" })
      });
      const player = await response.json();
      return NextResponse.json({ id: player.id, name: player.title.rendered, slug: player.slug });
    }

    if (action === 'sync-event') {
      const { eventName, standings, leagueId, seasonId, matches, participants } = body;
      
      // 1. Find or Create Players
      const wpPlayersResponse = await fetch(`${baseUrl}/wp-json/sportspress/v2/players?per_page=100`, {
        headers: { Authorization: authHeader },
      });
      const existingWpPlayers = await wpPlayersResponse.json();
      
      const results: any = {};
      for (let i = 0; i < standings.length; i++) {
        const standing = standings[i];
        let wpPlayer = existingWpPlayers.find((p: any) => p.title.rendered.toLowerCase() === standing.name.toLowerCase());
        
        if (!wpPlayer) {
          const createResponse = await fetch(`${baseUrl}/wp-json/sportspress/v2/players`, {
            method: "POST",
            headers: { Authorization: authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ title: standing.name, status: "publish" })
          });
          if (createResponse.ok) wpPlayer = await createResponse.json();
        }
        
        if (wpPlayer) {
          results[wpPlayer.id] = {
            w: standing.wins || 0, l: standing.losses || 0, pts: standing.points || 0,
            spinfin: standing.spn || 0, burfin: standing.bur || 0, ovrfin: standing.ovr || 0,
            extfin: standing.ext || 0, pp: standing.pen || 0, eventsattended: 1,
            onew: i === 0 ? 1 : 0, twow: i === 1 ? 1 : 0, threew: i === 2 ? 1 : 0,
            fourw: i === 3 ? 1 : 0, eightw: (i >= 4 && i <= 7) ? 1 : 0, ninew: 1
          };
        }
      }

      // 2. Create Event
      let content = "";
      if (Array.isArray(matches) && Array.isArray(participants)) {
        content = "<h3>Tournament Matches</h3><ul>";
        matches.forEach((m: any) => {
          const p1 = participants.find(p => p.id === m.player1_id);
          const p2 = participants.find(p => p.id === m.player2_id);
          const p1Name = p1 ? (p1.display_name || p1.name) : "TBD";
          const p2Name = p2 ? (p2.display_name || p2.name) : "TBD";
          const score = m.scores_csv ? ` (${m.scores_csv})` : "";
          content += `<li>${p1Name} vs ${p2Name}${score}</li>`;
        });
        content += "</ul>";
      }

      const eventData: any = { title: eventName, status: "publish", content, results };
      if (leagueId) eventData.leagues = [Number(leagueId)];
      if (seasonId) eventData.seasons = [Number(seasonId)];

      const eventResponse = await fetch(`${baseUrl}/wp-json/sportspress/v2/events`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(eventData)
      });
      const event = await eventResponse.json();
      return NextResponse.json({ success: true, message: `Synced ${standings.length} players`, eventId: event.id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
