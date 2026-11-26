import { redirect } from 'next/navigation';
import { pagePrincipal } from '@/server/page-session';
import { database } from '@/server/db';
import { MeetingService } from '@/server/meetings';
import { Meetings } from '@/components/meetings';
export const dynamic = 'force-dynamic';

export default async function MeetingsPage() {
  let principal;
  try { principal = await pagePrincipal(); }
  catch { redirect('/login'); }
  if (principal.role === 'bot') redirect('/');
  const { series } = await new MeetingService(await database()).list(principal);
  return <Meetings initial={JSON.parse(JSON.stringify(series))} />;
}
