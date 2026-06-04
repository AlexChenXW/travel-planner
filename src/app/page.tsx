"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Message { role: "user" | "assistant"; content: string; ts?: number }
interface Conv { id: number; title: string; updatedAt: string }

const API = process.env.NEXT_PUBLIC_API_URL || "";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* ── Voice input hook (WeChat-style: hold-to-talk) ── */
function useVoiceInput(onResult: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [cancelHint, setCancelHint] = useState(false);
  const cancelRef = useRef(false);
  const recogRef = useRef<any>(null);
  const startY = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const startRec = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (recogRef.current) { recogRef.current.stop(); recogRef.current = null; }
    const recog = new SR();
    recog.lang = "zh-CN";
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      if (text && !cancelRef.current) onResultRef.current(text);
      setRecording(false);
      setCancelHint(false);
      cancelRef.current = false;
    };
    recog.onerror = () => { setRecording(false); setCancelHint(false); cancelRef.current = false; };
    recog.onend = () => { setRecording(false); setCancelHint(false); cancelRef.current = false; };
    recogRef.current = recog;
    recog.start();
    setRecording(true);
    setCancelHint(false);
    cancelRef.current = false;
  }, []);

  const stopRec = useCallback(() => {
    recogRef.current?.stop();
    recogRef.current = null;
    setRecording(false);
    setCancelHint(false);
    cancelRef.current = false;
  }, []);

  const cancelRec = useCallback(() => {
    if (recogRef.current) { recogRef.current.abort(); recogRef.current = null; }
    setRecording(false);
    setCancelHint(false);
    cancelRef.current = true;
  }, []);

  // Touch handlers for hold-to-talk with slide-up-to-cancel
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    startY.current = e.touches[0].clientY;
    startRec();
  }, [startRec]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = startY.current - e.touches[0].clientY;
    const shouldCancel = dy > 60;
    setCancelHint(shouldCancel);
    cancelRef.current = shouldCancel;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (cancelRef.current) { cancelRec(); return; }
    stopRec();
  }, [cancelRec, stopRec]);

  // Mouse handlers for desktop
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startY.current = e.clientY;
    startRec();
  }, [startRec]);

  const onMouseUp = useCallback(() => {
    if (cancelRef.current) { cancelRec(); return; }
    stopRec();
  }, [cancelRec, stopRec]);

  const supported = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return { recording, cancelHint, supported, onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseUp };
}

/* ── Time-group helper ── */
function groupConvsByTime(convs: Conv[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conv[] }[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "近7天", items: [] },
    { label: "更早", items: [] },
  ];

  for (const c of convs) {
    const d = new Date(c.updatedAt);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= weekAgo) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter(g => g.items.length > 0);
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Conv | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(scroll, [messages, scroll]);
  useEffect(() => { fetchConvs(); loadSuggestions(); }, []);

  const voice = useVoiceInput((text) => setInput((prev) => (prev + (prev ? " " : "") + text)));

  async function fetchConvs() {
    try { const r = await fetch(`${API}/api/conversations`); setConvs(await r.json()); } catch {}
  }

  async function loadSuggestions() {
    try {
      const r = await fetch(`${API}/api/suggestions`);
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) setSuggestions(data);
    } catch {}
  }

  async function deleteConv(c: Conv) {
    await fetch(`${API}/api/conversations`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
    if (c.id === convId) newChat();
    fetchConvs();
    setDeleteTarget(null);
  }

  async function loadConv(id: number) {
    const r = await fetch(`${API}/api/conversations/${id}`);
    const d = await r.json();
    setMessages(d.messages.map((m: Message) => ({ role: m.role, content: m.content })));
    setConvId(id);
    setSidebar(false);
  }

  function newChat() {
    setMessages([]);
    setConvId(null);
    setSidebar(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg, ts: Date.now() }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message: msg }),
      });
      if (!res.ok) throw new Error();

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let ai = "";
      const aiTs = Date.now();
      setMessages((p) => [...p, { role: "assistant", content: "", ts: aiTs }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const d = JSON.parse(line.slice(6));
          if (d.text) {
            ai += d.text;
            setMessages((p) => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: ai }; return u; });
          }
          if (d.conversationId && !convId) setConvId(d.conversationId);
        }
      }
      fetchConvs();
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "网络异常，请重试" }]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const convGroups = groupConvsByTime(convs);

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between shrink-0 safe-top">
        <button onClick={() => setSidebar(true)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors -ml-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h14M3 10h14M3 14h14" /></svg>
        </button>
        <div className="flex items-center gap-1.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
          <span className="font-semibold text-[15px]">旅行助手</span>
        </div>
        <button onClick={newChat} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors -mr-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </header>

      {/* Sidebar */}
      <div className={`fixed inset-0 z-50 ${sidebar ? "visible" : "invisible"}`}>
        <div className={`sidebar-backdrop absolute inset-0 bg-black/30 ${sidebar ? "opacity-100" : "opacity-0"}`} onClick={() => setSidebar(false)} />
        <div className={`sidebar-panel absolute top-0 left-0 bottom-0 w-[280px] max-w-[80vw] bg-white flex flex-col shadow-2xl ${sidebar ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="font-semibold text-base">对话</span>
            <button onClick={() => setSidebar(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <button onClick={newChat} className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 border-b border-[var(--color-border)] text-[var(--color-primary)] font-medium text-sm flex items-center gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              新对话
            </button>

            {convGroups.map((group) => (
              <div key={group.label}>
                <div className="px-4 pt-3 pb-1 text-xs font-medium text-[var(--color-muted)]">{group.label}</div>
                {group.items.map((c) => (
                  <div key={c.id} className={`flex items-center border-b border-[var(--color-border)] text-sm transition-colors ${c.id === convId ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <button onClick={() => loadConv(c.id)} className={`flex-1 text-left px-4 py-3 ${c.id === convId ? "text-[var(--color-primary)]" : ""}`}>
                      <div className="truncate font-medium">{c.title}</div>
                    </button>
                    <button onClick={() => setDeleteTarget(c)} className="px-3 py-3 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M9 4v6M7 4v6M4 4l.5 8h5L10 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            ))}

            {convs.length === 0 && <div className="px-4 py-10 text-center text-[var(--color-muted)] text-sm">还没有对话记录</div>}
          </div>
          <div className="p-3 border-t border-[var(--color-border)] safe-bottom">
            <a href={`${BASE}/profile`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-sm text-[var(--color-primary)] font-medium">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
              旅行档案
            </a>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="pt-16 pb-8 px-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
              </div>
              <h2 className="text-xl font-semibold mb-1">你好 ✨</h2>
              <p className="text-[var(--color-muted)] text-sm mb-2 leading-relaxed">我是你的专属旅行顾问，能记住你的偏好，帮你规划行程</p>
              <p className="text-[var(--color-muted)] text-xs mb-8">说走就走，或者慢慢聊都可以 👇</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                {(suggestions.length > 0 ? suggestions : ["来一场说走就走的旅行，去哪好？", "有什么适合两人放松度假的地方？", "推荐一个没去过但值得去的国家", "假期有限，3-5天能去哪玩？"]).map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left px-4 py-3 rounded-xl bg-white border border-[var(--color-border)] text-sm text-gray-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-[0.98] transition-all shadow-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const showTime = msg.ts && (i === 0 || (messages[i-1]?.ts && msg.ts - messages[i-1]!.ts! > 3 * 60 * 1000));
            return (
              <div key={i}>
                {showTime && (
                  <div className="text-center text-xs text-[var(--color-muted)] my-2">
                    {new Date(msg.ts!).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-[var(--color-user-bg)] text-white px-4 py-2.5 rounded-2xl rounded-br-lg text-[15px] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-white px-4 py-3 rounded-2xl rounded-bl-lg text-[15px] leading-relaxed shadow-sm border border-[var(--color-border)]">
                      {msg.content ? (
                        <div className="msg-md">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="flex gap-1.5 py-1">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-t border-[var(--color-border)] safe-bottom">
        <div className="max-w-[680px] mx-auto px-3 py-2.5 flex items-end gap-2">
          <div className="flex-1 bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)] focus-within:border-[var(--color-primary)] focus-within:bg-white transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="想去哪里？"
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-2.5 text-[15px] focus:outline-none max-h-28 placeholder:text-[var(--color-muted)]"
              style={{ minHeight: "40px" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 112) + "px";
              }}
            />
          </div>

          {/* Voice button: hold-to-talk (WeChat style) */}
          {voice.supported && (
            <button
              onTouchStart={voice.onTouchStart}
              onTouchMove={voice.onTouchMove}
              onTouchEnd={voice.onTouchEnd}
              onMouseDown={voice.onMouseDown}
              onMouseUp={voice.onMouseUp}
              onMouseLeave={() => voice.recording && voice.onMouseUp()}
              className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-all select-none ${
                voice.recording
                  ? "bg-red-500 text-white scale-110"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95"
              }`}
              aria-label={voice.recording ? "松开发送" : "按住说话"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
          )}

          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white shrink-0 disabled:opacity-30 active:scale-95 transition-all"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l10-4-4 10-2-4z" /></svg>
          </button>
        </div>
      </div>

      {/* Voice recording overlay */}
      {voice.recording && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 confirm-dialog">
            {voice.cancelHint ? (
              <>
                <div className="text-red-400 text-3xl">✕</div>
                <span className="text-white text-sm">松开手指，取消发送</span>
              </>
            ) : (
              <>
                <div className="voice-ring-active relative w-16 h-16 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                  </div>
                </div>
                <span className="text-white text-sm">手指上滑，取消发送</span>
                <span className="text-white/50 text-xs">松开发送语音</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl mx-6 w-[calc(100%-48px)] max-w-[320px] overflow-hidden confirm-dialog">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" fill="none" stroke="#FF3B30" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-.7 12.6A2 2 0 0116.3 21H7.7a2 2 0 01-2-1.4L5 6M10 11v5M14 11v5" /></svg>
              </div>
              <h3 className="text-[16px] font-semibold text-gray-900 mb-1">删除对话</h3>
              <p className="text-sm text-[var(--color-muted)]">确定要删除「{deleteTarget.title}」吗？此操作无法撤销。</p>
            </div>
            <div className="flex border-t border-[var(--color-border)]">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 text-[15px] font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors border-r border-[var(--color-border)]">取消</button>
              <button onClick={() => deleteConv(deleteTarget)} className="flex-1 py-3.5 text-[15px] font-semibold text-[var(--color-danger)] hover:bg-red-50 active:bg-red-100 transition-colors">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
