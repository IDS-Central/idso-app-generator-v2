/**
 * / - Authenticated landing page.
 * Milestone 3.1: placeholder that confirms auth works.
 * Milestone 3.2 will replace this with the real chat UI.
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/session-constants';
import { decryptSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? decryptSession(raw) : null;

  // Middleware should have prevented unauthenticated access; defensive fallback:
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">Session missing. <a className="underline" href="/login">Sign in</a>.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">IDSO App Generator</h1>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{session.email}</span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">You are signed in</h2>
        <p className="mt-2 text-sm text-slate-600">
          This is the Milestone 3.1 placeholder. The chat UI lands in Milestone 3.2.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Try a backend ping: <a className="underline" href="/api/health">/api/health</a>
        </p>
      </section>
    </main>
  );
}
