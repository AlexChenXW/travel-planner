"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Message { role: "user" | "assistant"; content: string }
interface Conv { id: number; title: string; updatedAt: string }

const SUGGESTIONS = [
  "中秋国庆13天去哪好？",
  "帮我规划一次欧洲自然风光之旅",
  "两个人预算4万，7天去哪",
  "不想太累，推荐一个休闲的目的地",
];

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  const start = useCallback(() => {
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
      if (text) onResult(text);
      setListening(false);
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }, [onResult]);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  const supported = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return { listening, start, stop, supported };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [convs, setConvs] = useState<Conv[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(scroll, [messages, scroll]);
  useEffect(() => { fetchConvs(); }, []);

  const voice = useVoiceInput((text) => setInput((prev) => (prev + (prev ? " " : "") + text)));

  async function fetchConvs() {
    try { const r = await fetch("/api/conversations"); setConvs(await r.json()); } catch {}
  }

  async function loadConv(id: number) {
    const r = await fetch(`/api/conversations/${id}`);
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
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message: msg }),
      });
      if (!res.ok) throw new Error();

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let ai = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

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
            {convs.map((c) => (
              <button key={c.id} onClick={() => loadConv(c.id)} className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] text-sm transition-colors ${c.id === convId ? "bg-blue-50 text-[var(--color-primary)]" : "hover:bg-gray-50 active:bg-gray-100"}`}>
                <div className="truncate font-medium">{c.title}</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">{new Date(c.updatedAt).toLocaleDateString("zh-CN")}</div>
              </button>
            ))}
            {convs.length === 0 && <div className="px-4 py-10 text-center text-[var(--color-muted)] text-sm">还没有对话记录</div>}
          </div>
          <div className="p-3 border-t border-[var(--color-border)] safe-bottom">
            <a href="/profile" className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-sm text-[var(--color-primary)] font-medium">
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
              <h2 className="text-xl font-semibold mb-1">你好，Alex</h2>
              <p className="text-[var(--color-muted)] text-sm mb-8">告诉我你想去哪里，或者不知道去哪也可以问我</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left px-4 py-3 rounded-xl bg-white border border-[var(--color-border)] text-sm text-gray-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-[0.98] transition-all shadow-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            msg.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] bg-[var(--color-user-bg)] text-white px-4 py-2.5 rounded-2xl rounded-br-lg text-[15px] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
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
            )
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
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

          {/* Voice input */}
          {voice.supported && (
            <button
              onClick={voice.listening ? voice.stop : voice.start}
              className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-all active:scale-95 ${
                voice.listening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
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
    </div>
  );
}
