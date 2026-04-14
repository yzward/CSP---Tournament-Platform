export async function fetchFromChallonge(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`/api/challonge/${endpoint}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    }
  });
  
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${text.substring(0, 50)}...`);
  }
}

export function parseTournamentId(input: string, communityId?: string): { id: string, communityId?: string } {
  let id = input.trim();
  let community = communityId?.trim() || '';
  
  if (id.includes('challonge.com/')) {
    try {
      const urlStr = id.startsWith('http') ? id : `https://${id}`;
      const url = new URL(urlStr);
      const parts = url.pathname.replace(/^\/|\/$/g, '').split('/');
      const hostnameParts = url.hostname.split('.');
      const subdomain = hostnameParts.length > 2 ? hostnameParts[0] : null;
      
      if (subdomain && subdomain !== 'www' && subdomain !== 'challonge') {
        id = parts[0];
        community = community || subdomain;
      } else if (parts.length > 1 && (url.hostname === 'challonge.com' || url.hostname === 'www.challonge.com')) {
        id = parts[1];
        community = community || parts[0];
      } else {
        id = parts[0];
      }
    } catch (e) {
      id = id.split('challonge.com/').pop()?.split('?')[0] || id;
    }
  }

  if (community && !id.startsWith(`${community}-`)) {
    id = `${community}-${id}`;
  }

  return { id, communityId: community };
}
