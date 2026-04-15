import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && authData.session) {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user;
      const providerToken = authData.session.provider_token

      if (user && providerToken) {
        // Check Discord Guild Membership
        const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || '1311180569773867020'
        try {
          const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${providerToken}`
            }
          })
          
          if (guildsResponse.ok) {
            const guilds = await guildsResponse.json()
            const isInGuild = guilds.some((g: any) => g.id === guildId)
            
            if (!isInGuild) {
              // Not in the required server - Sign out and redirect with error
              await supabase.auth.signOut()
              return new NextResponse(`
                <html><body><script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'not_member' }, '*');
                    window.close();
                  } else {
                    window.location.href = '/?error=not_member';
                  }
                </script></body></html>
              `, { headers: { 'Content-Type': 'text/html' } })
            }
          } else {
            console.error('Failed to fetch Discord guilds:', await guildsResponse.text())
          }
        } catch (e) {
          console.error('Error checking Discord guild membership:', e)
        }

        // Check if player exists
        let { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('discord_id', user.id)
          .single()

        if (player) {
          // Update existing player's avatar, email and discord token
          const updateData: any = {
            discord_access_token: providerToken,
            email: user.email
          };
          
          if (user.user_metadata.avatar_url && player.avatar_url !== user.user_metadata.avatar_url) {
            updateData.avatar_url = user.user_metadata.avatar_url;
          }

          await supabase
            .from('players')
            .update(updateData)
            .eq('id', player.id);
        }

        // Return HTML to postMessage and close popup
        return new NextResponse(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentication successful. This window should close automatically.</p>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // Fallback redirect
  return new NextResponse(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR' }, '*');
            window.close();
          } else {
            window.location.href = '/login';
          }
        </script>
        <p>Authentication failed. This window should close automatically.</p>
      </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}
