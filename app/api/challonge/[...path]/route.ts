import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest(req, await params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest(req, await params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest(req, await params);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest(req, await params);
}

async function handleRequest(req: NextRequest, params: { path: string[] }) {
  const apiKey = process.env.CHALLONGE_API_KEY;

  if (!apiKey) {
    console.error("CHALLONGE_API_KEY is missing from environment variables.");
    return NextResponse.json({ error: "CHALLONGE_API_KEY is not configured on the server." }, { status: 500 });
  }

  const challongePath = params.path.join('/');
  const url = new URL(req.url);
  const queryParams = new URLSearchParams(url.search);
  
  // Add the API key to the query parameters
  queryParams.set("api_key", apiKey);

  const challongeUrl = `https://api.challonge.com/v1/${challongePath}.json?${queryParams.toString()}`;

  console.log(`Proxying ${req.method} request to Challonge: ${challongePath}`);

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      const body = await req.json();
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(challongeUrl, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      console.error(`Challonge API responded with ${response.status}:`, data);
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Challonge Proxy Error:", error);
    return NextResponse.json({ error: "Failed to communicate with Challonge API", details: error.message }, { status: 500 });
  }
}
