"use client";

import { useState, useEffect } from "react";

interface Insight {
  id: number;
  category: string;
  content: string;
  source: string;
  sourceConvId: number | null;
  status: string;
  confidence: number;
  manualOverride: string | null;
  createdAt: string;
  acceptedAt?: string;
  dismissedAt?: string;
}

interface Version {
  id: number;
  triggerType: string;
  note: string | null;
  createdAt: string;
}

interface ProfileData {
  active: {
    departureCities: string;
    preferences: Record<string, string>;
    constraints: Record<string, string>;
    visitedPlaces: string[];
    feedback: string[];
  };
  insights: {
    pending: Insight[];
    accepted: Insight[];
    dismissed: Insight[];
  };
  recentVersions: Version[];
}

const CATEGORY_ICONS: Record<string, string> = {
  departure: "✈️",
  preference: "🏔️",
  constraint: "🛡️",
  visited: "🗺️",
  feedback: "💬",
  budget: "💰",
  companion: "👥",
  season: "🌤️",
  other: "📌",
};

const CATEGORY_LABELS: Record<string, string> = {
  departure: "出发地",
  preference: "偏好",
  constraint: "约束",
  visited: "去过",
  feedback: "反馈",
  budget: "预算",
  companion: "同行",
  season: "季节",
  other: "其他",
};

const API = process.env.NEXT_PUBLIC_API_URL || "";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccepted, setShowAccepted] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCategory, setManualCategory] = useState("preference");
  const [manualContent, setManualContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { loadData(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  async function loadData() {
    try {
      const r = await fetch(`${API}/api/profile`);
      const d = await r.json();
      setData(d);
    } catch { console.error("Failed to load profile"); }
    setLoading(false);
  }

  async function insightAction(action: string, insightId: number, manualOverride?: string) {
    await fetch(`${API}/api/profile/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, insightId, manualOverride }),
    });
    showToast(action === "accept" ? "已接受" : action === "dismiss" ? "已忽略" : action === "restore" ? "已恢复" : "已保存");
    loadData();
  }

  async function createManual() {
    if (!manualContent.trim()) return;
    await fetch(`${API}/api/profile/insights/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: manualCategory, content: manualContent.trim() }),
    });
    setManualContent("");
    setShowManual(false);
    showToast("已添加");
    loadData();
  }

  function confidenceBadge(c: number) {
    if (c >= 8) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">高可信</span>;
    if (c >= 5) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-600 font-medium">待确认</span>;
    return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">需验证</span>;
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        <span className="text-[var(--color-muted)] text-sm">加载中...</span>
      </div>
    );
  }

  const pending = data?.insights.pending || [];
  const accepted = data?.insights.accepted || [];
  const dismissed = data?.insights.dismissed || [];
  const versions = data?.recentVersions || [];

  // Check if profile is essentially empty
  const hasContent = data?.active.departureCities
    || (data?.active.visitedPlaces?.length ?? 0) > 0
    || Object.values(data?.active.preferences || {}).length > 0
    || accepted.length > 0;

  return (
    <div className="min-h-full bg-[var(--color-background)]">
      <header className="bg-white/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 py-2.5 flex items-center gap-2 sticky top-0 z-10 safe-top">
        <a href={`${BASE}/`} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </a>
        <h1 className="font-semibold text-[16px]">旅行档案</h1>
        {pending.length > 0 && (
          <span className="ml-auto bg-[var(--color-primary)] text-white text-xs px-2 py-0.5 rounded-full font-medium animate-pulse">{pending.length} 条新发现</span>
        )}
      </header>

      <div className="max-w-xl mx-auto px-4 pt-4 pb-32 space-y-4">

        {/* Pending Insights — show FIRST if any (highest priority) */}
        {pending.length > 0 && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📬</span>
              <label className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide">新发现 · 待审核</label>
              <span className="text-xs text-[var(--color-muted)] ml-auto">AI 从对话中学到的</span>
            </div>
            <div className="space-y-2.5">
              {pending.map((ins) => (
                <div key={ins.id} className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-base shrink-0">{CATEGORY_ICONS[ins.category] || "📌"}</span>
                    <div className="flex-1 min-w-0">
                      {editingId === ins.id ? (
                        <div className="space-y-2">
                          <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-primary)]" rows={2} />
                          <div className="flex gap-2">
                            <button onClick={() => { insightAction("accept", ins.id, editText); setEditingId(null); }} className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs rounded-lg font-medium active:scale-95 transition-transform">保存</button>
                            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium">取消</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-800">{ins.content}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[var(--color-muted)]">{CATEGORY_LABELS[ins.category] || ins.category}</span>
                            {confidenceBadge(ins.confidence)}
                            <span className="text-xs text-[var(--color-muted)]">{timeAgo(ins.createdAt)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId !== ins.id && (
                    <div className="flex gap-2 ml-7">
                      <button onClick={() => insightAction("accept", ins.id)} className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs rounded-lg font-medium active:scale-95 transition-transform">✓ 接受</button>
                      <button onClick={() => { setEditingId(ins.id); setEditText(ins.content); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium active:scale-95 transition-transform">✎ 编辑</button>
                      <button onClick={() => insightAction("dismiss", ins.id)} className="px-3 py-1.5 bg-gray-100 text-gray-400 text-xs rounded-lg font-medium active:scale-95 transition-transform">✕ 忽略</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 1: Active Profile */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🧠</span>
            <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">AI 了解的你</label>
            {accepted.length > 0 && (
              <span className="text-xs text-[var(--color-muted)] ml-auto">{accepted.length} 条洞察</span>
            )}
          </div>

          {hasContent ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span>✈️</span>
                <span className="text-[var(--color-muted)]">出发城市：</span>
                <span className="font-medium">{data?.active.departureCities || "未设置"}</span>
              </div>

              {data?.active.visitedPlaces.length ? (
                <div>
                  <div className="flex items-start gap-2">
                    <span>🗺️</span>
                    <span className="text-[var(--color-muted)]">已去过：</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1 ml-6">
                    {data.active.visitedPlaces.map((p, i) => (
                      <span key={i} className="px-2 py-1 rounded-full bg-blue-50 text-[var(--color-primary)] text-xs font-medium">{p}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {Object.values(data?.active.preferences || {}).length > 0 && (
                <div>
                  <div className="flex items-start gap-2">
                    <span>🏔️</span>
                    <span className="text-[var(--color-muted)]">偏好：</span>
                  </div>
                  <div className="ml-6 mt-1 space-y-0.5">
                    {Object.values(data!.active.preferences).map((p, i) => (
                      <div key={i} className="text-gray-700">· {p}</div>
                    ))}
                  </div>
                </div>
              )}

              {Object.values(data?.active.constraints || {}).length > 0 && (
                <div>
                  <div className="flex items-start gap-2">
                    <span>🛡️</span>
                    <span className="text-[var(--color-muted)]">约束：</span>
                  </div>
                  <div className="ml-6 mt-1 space-y-0.5">
                    {Object.values(data!.active.constraints).map((c, i) => (
                      <div key={i} className="text-gray-700">· {c}</div>
                    ))}
                  </div>
                </div>
              )}

              {data?.active.feedback.length ? (
                <div>
                  <div className="flex items-start gap-2">
                    <span>💬</span>
                    <span className="text-[var(--color-muted)]">反馈：</span>
                  </div>
                  <div className="ml-6 mt-1 space-y-0.5">
                    {data.active.feedback.map((f, i) => (
                      <div key={i} className="text-gray-600">· {f}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🌱</div>
              <p className="text-sm text-[var(--color-muted)] mb-1">还没有档案信息</p>
              <p className="text-xs text-[var(--color-muted)]">开始聊天后，我会自动学习你的偏好</p>
            </div>
          )}
        </section>

        {/* Section 2: Accepted Insights */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <button onClick={() => setShowAccepted(!showAccepted)} className="w-full flex items-center gap-2">
            <span className="text-base">✅</span>
            <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">已确认的偏好</span>
            <span className="text-xs text-[var(--color-muted)] ml-1">({accepted.length})</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className={`ml-auto transition-transform ${showAccepted ? "rotate-180" : ""}`}><path d="M3 5l4 4 4-4" /></svg>
          </button>
          {showAccepted && (
            <div className="pt-3 pb-1 space-y-2">
              {(() => {
                const catGroups = new Map<string, Insight[]>();
                for (const ins of accepted) {
                  const list = catGroups.get(ins.category) || [];
                  list.push(ins);
                  catGroups.set(ins.category, list);
                }
                return Array.from(catGroups.entries()).map(([cat, items]) => (
                  <div key={cat} className="bg-gray-50/80 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">{CATEGORY_ICONS[cat] || "📌"}</span>
                      <span className="text-xs font-medium text-gray-600">{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="text-xs text-gray-400">({items.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {items.map((ins) => (
                        <span key={ins.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[var(--color-border)] text-xs">
                          <span className="text-gray-700 max-w-[140px] truncate">{ins.manualOverride || ins.content}</span>
                          <button onClick={() => insightAction("dismiss", ins.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ));
              })()}
              {accepted.length === 0 && (
                <div className="text-center py-3">
                  <p className="text-xs text-[var(--color-muted)]">聊天越多，我了解你越多 ✨</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 3: Dismissed (collapsible) */}
        {dismissed.length > 0 && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <button onClick={() => setShowDismissed(!showDismissed)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🗑️</span>
                <span className="text-xs text-gray-400">已忽略 ({dismissed.length})</span>
              </div>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-300 transition-transform ${showDismissed ? "rotate-180" : ""}`}><path d="M3 5l4 4 4-4" /></svg>
            </button>
            {showDismissed && (
              <div className="space-y-1 pt-2 pb-1">
                {dismissed.map((ins) => (
                  <div key={ins.id} className="flex items-center justify-between text-xs text-gray-400 py-1">
                    <span className="truncate flex-1 mr-2 line-through">{ins.content}</span>
                    <button onClick={() => insightAction("restore", ins.id)} className="text-[var(--color-primary)] shrink-0 font-medium">恢复</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Section 4: History (collapsible) */}
        {versions.length > 0 && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📜</span>
                <span className="text-xs text-gray-400">变更历史</span>
              </div>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-300 transition-transform ${showHistory ? "rotate-180" : ""}`}><path d="M3 5l4 4 4-4" /></svg>
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${v.triggerType === "manual" ? "bg-blue-400" : v.triggerType === "import" ? "bg-gray-300" : "bg-green-400"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-700">{v.note || v.triggerType}</span>
                    </div>
                    <span className="text-xs text-[var(--color-muted)] shrink-0">{timeAgo(v.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Manual Add + Toast */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[var(--color-border)] px-4 py-3 safe-bottom">
        <div className="max-w-xl mx-auto">
          {toast && (
            <div className="text-center text-sm font-medium text-[var(--color-success)] mb-2 animate-pulse">{toast}</div>
          )}
          {showManual ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={manualCategory} onChange={e => setManualCategory(e.target.value)} className="border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--color-primary)]">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{CATEGORY_ICONS[k]} {v}</option>
                  ))}
                </select>
                <input value={manualContent} onChange={e => setManualContent(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); createManual(); }}} placeholder="输入偏好内容" className="flex-1 border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]" />
              </div>
              <div className="flex gap-2">
                <button onClick={createManual} className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-95 transition-transform">添加</button>
                <button onClick={() => setShowManual(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">取消</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowManual(true)} className="w-full py-3 rounded-2xl font-semibold text-[15px] bg-[var(--color-primary)] text-white transition-all active:scale-[0.98]">
              + 手动添加偏好
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
