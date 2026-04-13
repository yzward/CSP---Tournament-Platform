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
              return NextResponse.redirect(`${origin}/?error=not_member`)
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

        if (!player) {
          // Check for pending claim
          const { data: claim } = await supabase
            .from('account_claims')
            .select('id')
            .eq('auth_user_id', user.id)
            .eq('status', 'pending')
            .single()

          if (!claim) {
            // No player and no pending claim - redirect to claim page
            return NextResponse.redirect(`${origin}/claim`)
          } else {
            // Pending claim exists - redirect to claim page (which shows review status)
            return NextResponse.redirect(`${origin}/claim`)
          }
        }

        // Update existing player's avatar and discord token
        const updateData: any = {
          discord_access_token: providerToken
        };
        
        if (user.user_metadata.avatar_url && player.avatar_url !== user.user_metadata.avatar_url) {
          updateData.avatar_url = user.user_metadata.avatar_url;
        }

        await supabase
          .from('players')
          .update(updateData)
          .eq('id', player.id);

        // Handle Role-Based Redirect
        let redirectPath = '/'
        
        if (player) {
          {
            const { data: userRoles } = await supabase
              .from('user_roles')
              .select('roles(name)')
              .eq('player_id', player.id)

            const roleNames = userRoles?.map((r: any) => r.roles?.name || r.roles?.[0]?.name) || []

            if (roleNames.includes('Admin')) {
              redirectPath = '/admin'
            } else if (roleNames.includes('Ops')) {
              redirectPath = '/operations'
            } else if (roleNames.includes('Referee') || roleNames.includes('Temp Referee')) {
              redirectPath = '/referee'
            }
          }
        }

        return NextResponse.redirect(`${origin}${redirectPath}`)
      }
    }
  }

  // Fallback redirect
  return NextResponse.redirect(`${origin}/login`)
}
