"use client";

import { useState, useEffect } from "react";

interface ProfileData {
  departureCities: string;
  preferences: Record<string, string>;
  constraints: Record<string, string>;
  visitedPlaces: string[];
  feedback: string[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>({
    departureCities: "深圳/香港/广州",
    preferences: {},
    constraints: {},
    visitedPlaces: [],
    feedback: [],
  });
  const [saved, setSaved] = useState(false);
  const [newPlace, setNewPlace] = useState("");
  const [newFeedback, setNewFeedback] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => setProfile(data));
  }, []);

  async function save() {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updatePreference(key: string, value: string) {
    setProfile((p) => ({ ...p, preferences: { ...p.preferences, [key]: value } }));
  }

  function updateConstraint(key: string, value: string) {
    setProfile((p) => ({ ...p, constraints: { ...p.constraints, [key]: value } }));
  }

  function addPlace() {
    if (!newPlace.trim()) return;
    setProfile((p) => ({ ...p, visitedPlaces: [...p.visitedPlaces, newPlace.trim()] }));
    setNewPlace("");
  }

  function removePlace(index: number) {
    setProfile((p) => ({
      ...p,
      visitedPlaces: p.visitedPlaces.filter((_, i) => i !== index),
    }));
  }

  function addFeedback() {
    if (!newFeedback.trim()) return;
    setProfile((p) => ({ ...p, feedback: [...p.feedback, newFeedback.trim()] }));
    setNewFeedback("");
  }

  function removeFeedback(index: number) {
    setProfile((p) => ({
      ...p,
      feedback: p.feedback.filter((_, i) => i !== index),
    }));
  }

  const prefFields = [
    { key: "旅行风格", placeholder: "自然风光为主，城市人文为辅" },
    { key: "住宿偏好", placeholder: "中档酒店/民宿" },
    { key: "饮食偏好", placeholder: "当地美食、中餐均可" },
    { key: "节奏偏好", placeholder: "适中，不要太赶" },
  ];

  const constraintFields = [
    { key: "安全要求", placeholder: "很重要" },
    { key: "签证限制", placeholder: "基本无限制" },
    { key: "语言限制", placeholder: "中文/英语" },
    { key: "其他", placeholder: "不要太艰苦" },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center gap-3">
        <a href="/" className="p-1 -ml-1">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-lg font-semibold">旅行档案</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Departure Cities */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-3">出发城市</h2>
          <input
            value={profile.departureCities}
            onChange={(e) => setProfile((p) => ({ ...p, departureCities: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            placeholder="深圳/香港/广州"
          />
        </section>

        {/* Preferences */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-3">偏好</h2>
          <div className="space-y-3">
            {prefFields.map((f) => (
              <div key={f.key}>
                <label className="text-sm text-gray-600 mb-1 block">{f.key}</label>
                <input
                  value={profile.preferences[f.key] || ""}
                  onChange={(e) => updatePreference(f.key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Constraints */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-3">硬约束</h2>
          <div className="space-y-3">
            {constraintFields.map((f) => (
              <div key={f.key}>
                <label className="text-sm text-gray-600 mb-1 block">{f.key}</label>
                <input
                  value={profile.constraints[f.key] || ""}
                  onChange={(e) => updateConstraint(f.key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Visited Places */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-3">已去过的地方</h2>
          <div className="flex gap-2 mb-3">
            <input
              value={newPlace}
              onChange={(e) => setNewPlace(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlace()}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="输入地名后回车添加"
            />
            <button
              onClick={addPlace}
              className="bg-blue-800 text-white px-4 py-2 rounded-lg text-sm"
            >
              添加
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.visitedPlaces.map((place, i) => (
              <span
                key={i}
                className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1"
              >
                {place}
                <button onClick={() => removePlace(i)} className="text-blue-400 hover:text-red-400">
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Feedback */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold mb-3">反馈与教训</h2>
          <div className="flex gap-2 mb-3">
            <input
              value={newFeedback}
              onChange={(e) => setNewFeedback(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFeedback()}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="如：不喜欢X类型的行程"
            />
            <button
              onClick={addFeedback}
              className="bg-blue-800 text-white px-4 py-2 rounded-lg text-sm"
            >
              添加
            </button>
          </div>
          <div className="space-y-2">
            {profile.feedback.map((fb, i) => (
              <div
                key={i}
                className="flex items-start justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm"
              >
                <span>{fb}</span>
                <button
                  onClick={() => removeFeedback(i)}
                  className="text-gray-400 hover:text-red-400 ml-2 shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={save}
            className="w-full bg-blue-800 text-white py-3 rounded-xl font-medium text-sm"
          >
            {saved ? "已保存 ✓" : "保存档案"}
          </button>
        </div>
      </div>
    </div>
  );
}
