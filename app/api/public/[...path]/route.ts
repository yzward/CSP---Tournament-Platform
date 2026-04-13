import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const routePath = path.join('/');
  const { searchParams } = new URL(request.url);
  const supabase = getSupabaseAdmin();

  if (!routePath || routePath === 'index') {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}/api/public`;

    return NextResponse.json({
      name: "Clash OPS Public API",
      version: "1.0.0",
      description: "Public read-only API for Clash OPS tournament data.",
      endpoints: {
        tournaments: { url: `${baseUrl}/tournaments`, method: "GET" },
        matches: { url: `${baseUrl}/matches`, method: "GET" }
      }
    });
  }

  try {
    if (routePath === 'tournaments') {
      const limitVal = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
      const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limitVal);

      if (error) throw error;
      return NextResponse.json({ success: true, count: tournaments.length, data: tournaments });
    }

    if (routePath === 'matches') {
      const limitVal = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
      const { data: matches, error } = await supabase
        .from('match_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limitVal);

      if (error) throw error;
      return NextResponse.json({ success: true, count: matches.length, data: matches });
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
