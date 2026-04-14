import { NextResponse } from 'next/server';
import { fetchStartGG, GET_USER_ORGANIZATIONS_QUERY } from '@/lib/startgg';

export async function GET() {
  try {
    const data = await fetchStartGG(GET_USER_ORGANIZATIONS_QUERY);
    
    if (!data || !data.currentUser) {
      return NextResponse.json({ error: 'Failed to fetch user data from start.gg' }, { status: 404 });
    }

    return NextResponse.json({ 
      organizations: data.currentUser.organizations?.nodes || [],
      userId: data.currentUser.id
    });
  } catch (error: any) {
    console.error('Start.gg Organizations Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch organizations' }, { status: 500 });
  }
}
