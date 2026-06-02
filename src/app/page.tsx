"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationSummary {
  id: number;
  title: string;
  updatedAt: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchConversations();
  }, []);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(data);
    } catch {}
  }

  async function loadConversation(id: number) {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    setMessages(data.messages.map((m: Message) => ({ role: m.role, content: m.content })));
    setConversationId(id);
    setSidebarOpen(false);
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: userMessage }),
      });

      if (!res.ok) throw new Error("请求失败");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.text) {
            aiContent += data.text;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: aiContent };
              return updated;
            });
          }

          if (data.conversationId && !conversationId) {
            setConversationId(data.conversationId);
          }
        }
      }

      fetchConversations();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "抱歉，出了点问题，请重试。" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => setSidebarOpen(true)} className="p-1 -ml-1">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">旅行助手</h1>
        <button onClick={startNewChat} className="p-1 -mr-1" title="新对话">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="bg-black/40 flex-1" onClick={() => setSidebarOpen(false)} />
          <div className="bg-white w-72 max-w-[80vw] flex flex-col shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-semibold">历史对话</span>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l8 8M14 6l-8 8" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <button
                onClick={startNewChat}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b text-blue-700 font-medium"
              >
                + 新建对话
              </button>
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b text-sm ${
                    c.id === conversationId ? "bg-blue-50 text-blue-700" : ""
                  }`}
                >
                  <div className="truncate">{c.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(c.updatedAt).toLocaleDateString("zh-CN")}
                  </div>
                </button>
              ))}
              {conversations.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">暂无历史对话</div>
              )}
            </div>
            <div className="p-3 border-t">
              <a
                href="/profile"
                className="block text-center text-sm text-blue-600 hover:text-blue-800 py-2"
              >
                编辑旅行档案
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20 px-4">
            <div className="text-4xl mb-4">✈️</div>
            <p className="text-lg font-medium mb-2">你好，Alex</p>
            <p className="text-sm">
              告诉我你想去哪里，或者不知道去哪也可以问我
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-800 text-white rounded-br-md"
                  : "bg-white shadow-sm border border-gray-100 rounded-bl-md message-content"
              }`}
            >
              {msg.content || (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 bg-white border-t px-4 py-3">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="问问旅行的事..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors max-h-32"
            style={{ minHeight: "42px" }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="bg-blue-800 text-white rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
