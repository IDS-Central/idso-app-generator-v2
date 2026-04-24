/**
 * /login - Public page. Shows the Google sign-in button.
 * Users are bounced here by middleware when they have no valid session.
 */
type SearchParams = Record<string, string | string[] | undefined>;

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: 'The login session expired or was tampered with. Please try again.',
  missing_params: 'Google did not return a valid response. Please try again.',
  wrong_hd: 'Only @independencedso.com Google accounts can sign in.',
  email_not_verified: 'Your Google account email is not verified.',
  invalid_issuer: 'The login token did not come from Google.',
  exchange_failed: 'Could not complete the Google sign-in. Please try again.',
  google_access_denied: 'You cancelled the Google sign-in.',
};

function friendlyError(code?: string): string | null {
  if (!code) return null;
  return ERROR_MESSAGES[code] ?? 'Sign-in failed. Please try again.';
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = searchParams;
  const errorCode = typeof params.error === 'string' ? params.error : undefined;
  const message = friendlyError(errorCode);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">IDSO App Generator</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with your <span className="font-medium">@independencedso.com</span> Google account
          to describe an app and have it built for you.
        </p>

        {message && (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {message}
          </div>
        )}

        <a
          href="/api/auth/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          Continue with Google
        </a>

        <p className="mt-6 text-xs text-slate-500">
          Your Google sign-in never leaves this tab, and only @independencedso.com accounts are
          accepted.
        </p>
      </div>
    </main>
  );
}
