/**
 * Authenticated landing page: the chat UI.
 * Milestone 3.2: replaces the placeholder from 3.1.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/lib/session-constants';
import { decryptSession } from '@/lib/session';
import ChatPage from '@/components/ChatPage';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;

  if (!session) {
    redirect('/login?next=%2F');
  }

  return <ChatPage userEmail={session.email} />;
}
