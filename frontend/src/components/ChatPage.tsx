'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Turn {
  turnNumber: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown[];
  pendingApproval?: boolean;
  toolUseId?: string;
}

interface SessionSummary {
  sessionId: string;
  title: string | null;
  lastActivityAt: string;
  createdAt: string;
}

interface Props {
  userEmail: string;
}

const SUGGESTIONS = [
  'Build a KPI dashboard that tracks doctor production over time',
  'Build a patient feedback form',
  'Build a weekly production report for each office',
];

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return '';
  }
}

export default function ChatPage({ userEmail }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new turns.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  // Load session list on mount + whenever we start a new session or finish a turn.
  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const resp = await fetch('/api/chat/sessions', { cache: 'no-store' });
      if (!resp.ok) return;
      const body = (await resp.json()) as { sessions?: SessionSummary[] };
      setSessions(Array.isArray(body.sessions) ? body.sessions : []);
    } catch {
      /* network hiccup; keep existing list */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // Start or resume the SSE stream for the current session.
  useEffect(() => {
    if (!sessionId) return;
    esRef.current?.close();
    const es = new EventSource(`/api/chat/${encodeURIComponent(sessionId)}/stream`);
    esRef.current = es;
    es.addEventListener('turn', (ev) => {
      try {
        const t = JSON.parse((ev as MessageEvent).data) as Turn;
        setTurns((prev) => {
          const next = prev.filter((x) => x.turnNumber !== t.turnNumber);
          next.push(t);
          next.sort((a, b) => a.turnNumber - b.turnNumber);
          return next;
        });
      } catch {
        /* ignore malformed */
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; surface nothing unless persistent.
    };
    return () => es.close();
  }, [sessionId]);

  const startNewSession = useCallback(async () => {
    setError(null);
    const resp = await fetch('/api/chat/sessions', { method: 'POST', body: '{}' });
    if (!resp.ok) {
      setError(`Could not start session (${resp.status})`);
      return null;
    }
    const body = (await resp.json()) as { sessionId?: string; session_id?: string };
    const sid = body.sessionId ?? body.session_id ?? null;
    if (sid) {
      setSessionId(sid);
      setTurns([]);
      void refreshSessions();
    }
    return sid;
  }, [refreshSessions]);

  const switchSession = useCallback((sid: string) => {
    if (sid === sessionId) return;
    setSessionId(sid);
    setTurns([]);
    setError(null);
  }, [sessionId]);

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setError(null);
      setSending(true);
      try {
        const sid = sessionId ?? (await startNewSession());
        if (!sid) return;

        // Optimistic user turn (backend will send canonical via SSE).
        setTurns((prev) => [
          ...prev,
          {
            turnNumber: prev.length + 1,
            role: 'user',
            content: text,
          },
        ]);
        setInput('');

        const resp = await fetch(`/api/chat/${encodeURIComponent(sid)}/turn`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        if (!resp.ok) {
          setError(`Turn failed (${resp.status})`);
        } else {
          // If LoopResult.status==='awaiting_approval', flag the matching
          // assistant turn so the approve/reject buttons appear.
          try {
            const result = (await resp.json()) as {
              status?: 'completed' | 'awaiting_approval' | 'error';
              turnNumber?: number;
              tool_use_id?: string;
            };
            if (result.status === 'awaiting_approval' && result.tool_use_id) {
              const toolUseId = result.tool_use_id;
              const targetTurn = result.turnNumber;
              setTurns((prev) => {
                let idx = -1;
                if (typeof targetTurn === 'number') {
                  idx = prev.findIndex(
                    (t) => t.turnNumber === targetTurn && t.role === 'assistant',
                  );
                }
                if (idx < 0) {
                  for (let i = prev.length - 1; i >= 0; i -= 1) {
                    if (prev[i].role === 'assistant') {
                      idx = i;
                      break;
                    }
                  }
                }
                if (idx < 0) return prev;
                const next = prev.slice();
                next[idx] = { ...next[idx], pendingApproval: true, toolUseId };
                return next;
              });
            }
          } catch {
            /* non-JSON response; ignore */
          }
        }
        void refreshSessions();
      } finally {
        setSending(false);
      }
    },
    [sessionId, sending, startNewSession, refreshSessions],
  );

  const approve = useCallback(
    async (toolUseId: string, decision: 'approve' | 'reject', note?: string) => {
      if (!sessionId || !toolUseId) return;
      const resp = await fetch(
        `/api/chat/${encodeURIComponent(sessionId)}/approve`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ toolUseId, decision, note }),
        },
      );
      if (!resp.ok) {
        setError(`Approve failed (${resp.status})`);
        return;
      }
      setTurns((prev) =>
        prev.map((t) =>
          t.toolUseId === toolUseId
            ? { ...t, pendingApproval: false }
            : t,
        ),
      );
      void refreshSessions();
    },
    [sessionId, refreshSessions],
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Left sidebar: session list */}
      <aside className="flex w-64 flex-col border-r bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Chats</h2>
            <p className="text-xs text-slate-500 truncate" title={userEmail}>{userEmail}</p>
          </div>
          <button
            onClick={() => {
              setSessionId(null);
              setTurns([]);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
            title="Start a new chat"
          >
            + New
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {sessionsLoading && sessions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">No chats yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => {
                const active = s.sessionId === sessionId;
                return (
                  <li key={s.sessionId}>
                    <button
                      onClick={() => switchSession(s.sessionId)}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${active ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700'}`}
                    >
                      <div className="truncate">{s.title ?? 'Untitled chat'}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{formatRelative(s.lastActivityAt)}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        <a
          href="/api/auth/logout"
          className="border-t px-4 py-3 text-center text-xs text-slate-500 hover:bg-slate-50"
        >
          Sign out
        </a>
      </aside>

      {/* Main column: chat */}
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <h1 className="text-lg font-semibold text-slate-900">IDSO App Generator</h1>
          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Agent working...
            </div>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          {turns.length === 0 ? (
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold text-slate-800">What should we build?</h2>
              <p className="mt-2 text-sm text-slate-500">
                Describe an internal app in plain English. The generator can create dashboards,
                forms, and reports backed by your data.
              </p>
              <div className="mt-6 grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {turns.map((t) => (
                <TurnBubble key={t.turnNumber} turn={t} onApprove={approve} />
              ))}
              {sending && (
                <div className="flex items-start">
                  <div className="max-w-[80%] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
                    <span className="inline-block animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          className="border-t bg-white px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
        >
          <div className="mx-auto flex max-w-3xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what to build..."
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
            >
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function renderTurnContent(turn: Turn): string {
  const c = turn.content as unknown;
  if (c == null) return '';
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object') {
          const b = block as { type?: string; text?: string; output?: string };
          if (typeof b.text === 'string') return b.text;
          if (typeof b.output === 'string') return b.output;
          return JSON.stringify(block);
        }
        return String(block);
      })
      .join('\n');
  }
  if (typeof c === 'object') {
    const o = c as { is_error?: boolean; output?: unknown; tool_use_id?: string };
    const body = typeof o.output === 'string' ? o.output : JSON.stringify(o.output ?? o);
    return o.is_error ? `[error] ${body}` : body;
  }
  return String(c);
}

function TurnBubble({
  turn,
  onApprove,
}: {
  turn: Turn;
  onApprove: (
    toolUseId: string,
    decision: 'approve' | 'reject',
  ) => void;
}) {
  const align = turn.role === 'user' ? 'items-end' : 'items-start';
  const bg =
    turn.role === 'user'
      ? 'bg-slate-900 text-white'
      : turn.role === 'tool'
        ? 'bg-amber-50 text-amber-900 border border-amber-200'
        : 'bg-white text-slate-800 border border-slate-200';
  return (
    <div className={`flex flex-col ${align}`}>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${bg}`}>
        {renderTurnContent(turn)}
      </div>
      {turn.pendingApproval && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => turn.toolUseId && onApprove(turn.toolUseId, 'approve')}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Approve
          </button>
          <button
            onClick={() => turn.toolUseId && onApprove(turn.toolUseId, 'reject')}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
