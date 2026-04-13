import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const action = searchParams.get('action');

  const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
  const DISCORD_ALLOWED_ROLE_IDS = (process.env.DISCORD_ALLOWED_ROLE_IDS || "").split(",").map(id => id.trim()).filter(Boolean);

  const protocol = request.headers.get('x-forwarded-proto') || (request.headers.get('host')?.includes('localhost') ? 'http' : 'https');
  const host = request.headers.get('host');
  const redirectUri = `${protocol}://${host}/api/auth/discord`;

  // 1. Handle URL Request
  if (action === 'url' || (!code && !action)) {
    if (!DISCORD_CLIENT_ID) {
      return NextResponse.json({ error: "DISCORD_CLIENT_ID is not configured." }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify guilds.members.read",
    });

    return NextResponse.json({ url: `https://discord.com/api/oauth2/authorize?${params.toString()}` });
  }

  // 2. Handle Callback
  if (code) {
    try {
      // Exchange code for token
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID!,
          client_secret: DISCORD_CLIENT_SECRET!,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error_description || tokenData.error);

      const accessToken = tokenData.access_token;

      // Get User Info
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userResponse.json();

      // Get Guild Member Info
      let hasAllowedRole = false;
      let roles: string[] = [];

      if (DISCORD_GUILD_ID) {
        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (memberResponse.ok) {
          const memberData = await memberResponse.json();
          roles = memberData.roles || [];
          hasAllowedRole = DISCORD_ALLOWED_ROLE_IDS.length === 0 || roles.some(roleId => DISCORD_ALLOWED_ROLE_IDS.includes(roleId));
        }
      } else {
        hasAllowedRole = true;
      }

      if (!hasAllowedRole) {
        return new NextResponse(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_ERROR', 
                  error: 'cannot access clash stats' 
                }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      // Success
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                user: ${JSON.stringify({
                  id: userData.id,
                  username: userData.username,
                  avatar: userData.avatar,
                  email: userData.email,
                  roles: roles
                })}
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });

    } catch (error: any) {
      console.error("Discord Auth Error:", error);
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_ERROR', 
                error: ${JSON.stringify(error.message || String(error))}
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
