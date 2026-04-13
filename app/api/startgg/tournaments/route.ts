import { NextResponse } from 'next/server';
import { fetchStartGG } from '@/lib/startgg';

const GET_CURRENT_USER_TOURNAMENTS = `
  query CurrentUserTournaments {
    currentUser {
      id
      name
      tournaments(query: { perPage: 50 }) {
        nodes {
          id
          name
          slug
          startAt
        }
      }
    }
  }
`;

export async function GET() {
  try {
    const data = await fetchStartGG(GET_CURRENT_USER_TOURNAMENTS);
    
    if (!data || !data.currentUser) {
      return NextResponse.json({ error: 'Could not fetch tournaments for the current start.gg user.' }, { status: 404 });
    }

    return NextResponse.json({ tournaments: data.currentUser.tournaments.nodes });
  } catch (error: any) {
    console.error('Start.gg Fetch Tournaments Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch tournaments from start.gg' }, { status: 500 });
  }
}
