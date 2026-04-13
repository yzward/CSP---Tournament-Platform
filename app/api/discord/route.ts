import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, tournamentId, matchId, eventName, eventUrl, clashUrl, standings, totals, includeTop3, includeTop10, overallStandings, includeEvaroonLink, mode } = body;

    const supabase = getSupabaseAdmin();

    // 1. Handle legacy "post-stats" body (from src/App.tsx)
    if (eventName || mode) {
      if (!discordWebhookUrl) {
        return NextResponse.json({ error: "DISCORD_WEBHOOK_URL is not configured." }, { status: 500 });
      }

      const medals = ["🥇", "🥈", "🥉"];
      const divider = "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";
      const fields = [];

      if (mode === 'current') {
        let displayStandings = standings || [];
        if (includeTop3) displayStandings = displayStandings.slice(0, 3);
        else if (includeTop10) displayStandings = displayStandings.slice(0, 10);

        let featuredStandings = displayStandings.slice(0, 10).map((s: any, i: number) => {
          const rankIndicator = medals[i] || `**${i + 1}.**`;
          const stats = `\`${s.wins || 0}W-${s.losses || 0}L\` • \`${s.points || 0} pts\``;
          const details = `\`BUR:${s.bur || 0} | EXT:${s.ext || 0} | OVR:${s.ovr || 0} | SPN:${s.spn || 0} | PEN:${s.pen || 0}\``;
          return `${rankIndicator} **${s.name || 'Unknown'}**\n${stats}\n${details}\n${divider}`;
        }).join('\n');

        if (featuredStandings && clashUrl) {
          featuredStandings += `\n- **[View full stats on Clash Website](${clashUrl})**`;
        }

        const remainingStandings = displayStandings.slice(10).map((s: any, i: number) => {
          return `\`#${i + 11}\` **${s.name}** (${s.wins}-${s.losses}) \`B:${s.bur}|E:${s.ext}|O:${s.ovr}\``;
        }).join(' • ');

        if (totals) {
          const safeTotals = {
            matches: totals?.matches || 0,
            xtr: totals?.xtr || 0,
            ovr: totals?.ovr || 0,
            bur: totals?.bur || 0,
            spn: totals?.spn || 0,
          };
          fields.push({
            name: "📊 Event Totals",
            value: `**Matches:** \`${safeTotals.matches}\`\n**Xtreme:** \`${safeTotals.xtr}\` • **Over:** \`${safeTotals.ovr}\`\n**Burst:** \`${safeTotals.bur}\` • **Spin:** \`${safeTotals.spn}\``,
            inline: false
          });
        }

        if (displayStandings.length > 0) {
          let standingsTitle = "Top 10 ranking spots!";
          if (includeTop3) standingsTitle = "Top 3 ranking spots!";
          else if (!includeTop10 && displayStandings.length > 10) standingsTitle = "Tournament Standings";

          fields.push({
            name: standingsTitle,
            value: featuredStandings || "No standings data available",
            inline: false
          });

          if (remainingStandings && !includeTop3 && !includeTop10) {
            const truncatedRemaining = remainingStandings.length > 1000 ? remainingStandings.substring(0, 997) + "..." : remainingStandings;
            fields.push({ name: "📋 Full Field Rankings", value: truncatedRemaining, inline: false });
          }
        }
      } else {
        if (overallStandings && overallStandings.length > 0) {
          let displayOverall = overallStandings;
          if (includeTop3) displayOverall = displayOverall.slice(0, 3);
          else if (includeTop10) displayOverall = displayOverall.slice(0, 10);

          let overallFormatted = displayOverall.map((s: any, i: number) => {
            const rankIndicator = medals[i] || `**${i + 1}.**`;
            return `${rankIndicator} **${s.name}** • \`${s.points} pts\` (\`${s.wins}W-${s.losses}L\`)`;
          }).join('\n');

          if (overallFormatted && clashUrl) {
            overallFormatted += `\n- **[View full stats on Clash Website](${clashUrl})**`;
          }

          let title = "Top 10 ranking spots!";
          if (includeTop3) title = "Top 3 ranking spots!";
          else if (!includeTop10 && displayOverall.length > 10) title = "🌍 Overall Rankings";

          fields.push({ name: title, value: overallFormatted, inline: false });
        }
      }

      let content = "";
      if (includeEvaroonLink && eventUrl) {
        content = `Stay up to date with the action here!\nLINK: ${eventUrl}`;
      }

      const embed: any = {
        title: mode === 'overall' ? "🌍 Overall Standings" : `🏆 ${(eventName || 'Tournament').substring(0, 250)} - Results`,
        color: mode === 'overall' ? 0x10B981 : 0x5865F2,
        description: mode === 'overall' ? "Global rankings across all events." : (eventUrl ? `🔗 **[View Full Bracket on Evaroon](${eventUrl})**` : "Tournament results breakdown."),
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "Clash Stats Pro • Tournament Manager" }
      };

      if (eventUrl && (eventUrl.startsWith('http://') || eventUrl.startsWith('https://'))) {
        embed.url = eventUrl;
      }

      const response = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, embeds: [embed] }),
      });

      if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
      return NextResponse.json({ success: true });
    }

    // 2. Handle new structured types (from Next.js routes)
    if (type === 'match_result') {
      const { data: match, error: matchError } = await (supabase as any)
        .from('matches')
        .select(`
          id,
          notes,
          scores,
          tournament:tournaments(name, is_ranking),
          player1:players!player1_id(display_name, ranking_points),
          player2:players!player2_id(display_name, ranking_points),
          referee:players!referee_id(display_name)
        `)
        .eq('id', matchId)
        .single();

      if (matchError || !match) throw matchError || new Error('Match not found');

      const tournament = Array.isArray(match.tournament) ? match.tournament[0] : match.tournament;
      const p1 = match.player1;
      const p2 = match.player2;
      const ref = match.referee;

      const embed = {
        title: `Match Result: ${tournament?.name || 'Tournament'}`,
        description: `${tournament?.is_ranking ? "🏆 **Ranking Tournament**" : "🎮 Casual Match"}`,
        color: 0x7c3aed,
        fields: [
          { name: "Players", value: `**${p1?.display_name || 'P1'}** (${p1?.ranking_points || 0} pts) vs **${p2?.display_name || 'P2'}** (${p2?.ranking_points || 0} pts)`, inline: false },
          { name: "Score", value: `**${match.scores?.player1 || 0} - ${match.scores?.player2 || 0}**`, inline: true },
          { name: "Referee", value: ref?.display_name || "Unknown", inline: true }
        ],
        timestamp: new Date().toISOString()
      };

      if (discordWebhookUrl && discordWebhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] })
        });
      }
    }

    if (type === 'tournament_complete') {
      const { data: tournamentData, error: tError } = await (supabase as any)
        .from('tournaments')
        .select(`
          name,
          is_ranking
        `)
        .eq('id', tournamentId)
        .single();

      if (tError || !tournamentData) throw tError || new Error('Tournament not found');

      const embeds = [];
      embeds.push({
        title: `Tournament Completed: ${tournamentData.name}`,
        description: `${tournamentData.is_ranking ? "🏆 **Ranking Points Awarded**" : "🎮 Casual Tournament Completed"}`,
        color: 0x7c3aed,
        timestamp: new Date().toISOString()
      });

      if (tournamentData.is_ranking) {
        const { data: leaderboard } = await (supabase as any).from('players').select('display_name, ranking_points').order('ranking_points', { ascending: false }).limit(5);
        if (leaderboard) {
          const leaderboardList = leaderboard.map((p: any, i: number) => `**#${i + 1}** ${p.display_name} — ${p.ranking_points} pts`).join('\n');
          embeds.push({ title: "Updated Leaderboard (Top 5)", description: leaderboardList, color: 0x7c3aed });
        }
      }

      if (discordWebhookUrl && discordWebhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds })
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Discord post error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
