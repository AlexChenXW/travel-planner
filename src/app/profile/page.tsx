"use client";

import { useState, useEffect } from "react";

interface Profile {
  departureCities: string;
  preferences: Record<string, string>;
  constraints: Record<string, string>;
  visitedPlaces: string[];
  feedback: string[];
}

const PREFS = [
  { key: "旅行风格", icon: "🏔️", hint: "自然风光为主，城市人文为辅" },
  { key: "住宿偏好", icon: "🏨", hint: "舒适型酒店/民宿" },
  { key: "饮食偏好", icon: "🍜", hint: "当地美食、中餐均可" },
  { key: "节奏偏好", icon: "🚶", hint: "适中，不要太赶" },
  { key: "交通方式", icon: "🚄", hint: "不自驾，可以包车/火车" },
  { key: "温度偏好", icon: "🌡️", hint: "不要太冷，不要热带海岛" },
];

const CONSTRAINTS = [
  { key: "安全要求", icon: "🛡️", hint: "很重要" },
  { key: "签证限制", icon: "📋", hint: "基本无限制" },
  { key: "语言限制", icon: "🗣️", hint: "中文/英语" },
  { key: "其他", icon: "📌", hint: "不要太艰苦" },
];

export default function ProfilePage() {
  const [p, setP] = useState<Profile>({ departureCities: "深圳/香港/广州", preferences: {}, constraints: {}, visitedPlaces: [], feedback: [] });
  const [saved, setSaved] = useState(false);
  const [addPlace, setAddPlace] = useState("");
  const [addFb, setAddFb] = useState("");

  useEffect(() => { fetch("/api/profile").then(r => r.json()).then(setP); }, []);

  async function save() {
    await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-full bg-[var(--color-background)]">
      <header className="bg-white/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 py-2.5 flex items-center gap-2 sticky top-0 z-10 safe-top">
        <a href="/" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </a>
        <h1 className="font-semibold text-[16px]">旅行档案</h1>
      </header>

      <div className="max-w-xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {/* Departure */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2 block">出发城市</label>
          <input value={p.departureCities} onChange={e => setP(prev => ({ ...prev, departureCities: e.target.value }))} className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-primary)] transition-colors" />
        </section>

        {/* Preferences */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3 block">偏好</label>
          <div className="space-y-3">
            {PREFS.map(f => (
              <div key={f.key}>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5"><span>{f.icon}</span>{f.key}</label>
                <input value={p.preferences[f.key] || ""} onChange={e => setP(prev => ({ ...prev, preferences: { ...prev.preferences, [f.key]: e.target.value } }))} placeholder={f.hint} className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-gray-300" />
              </div>
            ))}
          </div>
        </section>

        {/* Constraints */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3 block">硬约束</label>
          <div className="space-y-3">
            {CONSTRAINTS.map(f => (
              <div key={f.key}>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5"><span>{f.icon}</span>{f.key}</label>
                <input value={p.constraints[f.key] || ""} onChange={e => setP(prev => ({ ...prev, constraints: { ...prev.constraints, [f.key]: e.target.value } }))} placeholder={f.hint} className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-gray-300" />
              </div>
            ))}
          </div>
        </section>

        {/* Visited */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3 block">已去过的地方</label>
          <div className="flex gap-2 mb-3">
            <input value={addPlace} onChange={e => setAddPlace(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && addPlace.trim()) { setP(prev => ({ ...prev, visitedPlaces: [...prev.visitedPlaces, addPlace.trim()] })); setAddPlace(""); } }} className="flex-1 border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors" placeholder="输入地名，回车添加" />
            <button onClick={() => { if (addPlace.trim()) { setP(prev => ({ ...prev, visitedPlaces: [...prev.visitedPlaces, addPlace.trim()] })); setAddPlace(""); } }} className="px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-95 transition-transform">添加</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.visitedPlaces.map((place, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-[var(--color-primary)] text-sm font-medium">
                {place}
                <button onClick={() => setP(prev => ({ ...prev, visitedPlaces: prev.visitedPlaces.filter((_, j) => j !== i) }))} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-100 text-blue-400 hover:text-red-500 transition-colors">×</button>
              </span>
            ))}
            {p.visitedPlaces.length === 0 && <span className="text-sm text-[var(--color-muted)]">还没有记录</span>}
          </div>
        </section>

        {/* Feedback */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3 block">反馈与教训</label>
          <div className="flex gap-2 mb-3">
            <input value={addFb} onChange={e => setAddFb(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && addFb.trim()) { setP(prev => ({ ...prev, feedback: [...prev.feedback, addFb.trim()] })); setAddFb(""); } }} className="flex-1 border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors" placeholder="如：不喜欢紧凑的行程" />
            <button onClick={() => { if (addFb.trim()) { setP(prev => ({ ...prev, feedback: [...prev.feedback, addFb.trim()] })); setAddFb(""); } }} className="px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-95 transition-transform">添加</button>
          </div>
          <div className="space-y-2">
            {p.feedback.map((fb, i) => (
              <div key={i} className="flex items-start justify-between bg-[var(--color-background)] px-3.5 py-2.5 rounded-xl text-sm">
                <span>{fb}</span>
                <button onClick={() => setP(prev => ({ ...prev, feedback: prev.feedback.filter((_, j) => j !== i) }))} className="text-gray-300 hover:text-red-500 transition-colors ml-2 shrink-0">×</button>
              </div>
            ))}
            {p.feedback.length === 0 && <span className="text-sm text-[var(--color-muted)]">还没有反馈</span>}
          </div>
        </section>
      </div>

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[var(--color-border)] px-4 py-3 safe-bottom">
        <div className="max-w-xl mx-auto">
          <button onClick={save} className={`w-full py-3 rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.98] ${saved ? "bg-[var(--color-success)] text-white" : "bg-[var(--color-primary)] text-white"}`}>
            {saved ? "已保存" : "保存档案"}
          </button>
        </div>
      </div>
    </div>
  );
}
