import { redirect } from 'next/navigation';

// /results/[id] is a legacy route — redirect permanently to /tournaments/[id]
export default async function ResultsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/tournaments/${id}`);
}
