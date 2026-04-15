import { NextResponse } from 'next/server';

// Scan Challonge for open/pending tournaments — equivalent to V3's scanTournaments().
// Returns a lightweight list (id, name, url, state, participants_count) so the
// operations page can offer a "link to Challonge" picker without typing a URL.

export async function GET() {
  try {
    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'CHALLONGE_API_KEY is not configured' }, { status: 500 });
    }

    // Fetch tournaments in 'pending' + 'underway' states (open = active bracket)
    const [pendingRes, underwayRes] = await Promise.all([
      fetch(`https://api.challonge.com/v1/tournaments.json?state=pending&api_key=${apiKey}`),
      fetch(`https://api.challonge.com/v1/tournaments.json?state=underway&api_key=${apiKey}`),
    ]);

    if (!pendingRes.ok && !underwayRes.ok) {
      return NextResponse.json({ error: 'Failed to reach Challonge API' }, { status: 502 });
    }

    const [pendingData, underwayData] = await Promise.all([
      pendingRes.ok ? pendingRes.json() : [],
      underwayRes.ok ? underwayRes.json() : [],
    ]);

    const tournaments = [...(pendingData || []), ...(underwayData || [])]
      .map((item: any) => item.tournament)
      .filter(Boolean)
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        url: t.url,
        full_challonge_url: t.full_challonge_url,
        state: t.state,
        tournament_type: t.tournament_type,
        participants_count: t.participants_count,
        created_at: t.created_at,
      }));

    return NextResponse.json({ tournaments });

  } catch (error: any) {
    console.error('[Scan Tournaments] Error:', error);
    return NextResponse.json({ error: error.message || 'Scan failed' }, { status: 500 });
  }
}
