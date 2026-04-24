'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Turn {
  turnNumber: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown[];
  pendingApproval?: boolean;
}

interface Props {
  userEmail: string;
}

const SUGGESTIONS = [
  'Build a KPI dashboard that tracks doctor production over time',
  'Build a patient feedback form',
  'Build a weekly production report for each office',
];

export default function ChatPage({ userEmail }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new turns.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

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
    const { sessionId: sid } = (await resp.json()) as { sessionId: string };
    setSessionId(sid);
    setTurns([]);
    return sid;
  }, []);

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
        }
      } finally {
        setSending(false);
      }
    },
    [sessionId, sending, startNewSession],
  );

  const approve = useCallback(
    async (turnNumber: number, approved: boolean) => {
      if (!sessionId) return;
      await fetch(`/api/chat/${encodeURIComponent(sessionId)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnNumber, approved }),
      });
    },
    [sessionId],
  );

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">IDSO App Generator</h1>
          <p className="text-xs text-slate-500">Signed in as {userEmail}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSessionId(null);
              setTurns([]);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
          >
            New chat
          </button>
          <a
            href="/api/auth/logout"
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </a>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {turns.length === 0 ? (
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-slate-800">What should we build?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Describe an internal app in plain English. The generator can create dashboards, forms,
              and reports backed by your data.
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
    </div>
  );
}

function TurnBubble({
  turn,
  onApprove,
}: {
  turn: Turn;
  onApprove: (turnNumber: number, approved: boolean) => void;
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
        {turn.content}
      </div>
      {turn.pendingApproval && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onApprove(turn.turnNumber, true)}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Approve
          </button>
          <button
            onClick={() => onApprove(turn.turnNumber, false)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
