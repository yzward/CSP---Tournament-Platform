import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/discord/webhook
 *
 * Fire-and-forget Discord embed post for match results.
 * Body: { webhookUrl, player1, player2, score, winner, tournamentName?, stage? }
 */
export async function POST(req: NextRequest) {
  try {
    const { webhookUrl, player1, player2, score, winner, tournamentName, stage } = await req.json();

    if (!webhookUrl || !player1 || !player2) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const embed = {
      title: '⚔️ Match Result',
      description: `**${player1}** vs **${player2}**`,
      color: 0x7c3aed, // primary purple
      fields: [
        { name: 'Score', value: score || '—', inline: true },
        { name: 'Winner', value: `🏆 ${winner}`, inline: true },
        ...(stage ? [{ name: 'Round', value: stage, inline: true }] : []),
      ],
      footer: tournamentName ? { text: tournamentName } : undefined,
      timestamp: new Date().toISOString(),
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Non-critical — never block the caller
    console.warn('Discord webhook error (non-critical):', err.message);
    return NextResponse.json({ ok: false, error: err.message });
  }
}
