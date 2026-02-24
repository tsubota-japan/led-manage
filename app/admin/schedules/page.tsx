"use client";

import { useEffect, useState } from "react";

interface Group {
  id: string;
  name: string;
}

interface Schedule {
  id: string;
  groupId: string;
  startTime: string;
  endTime: string | null;
  repeat: string;
  priority: number;
  active: boolean;
  createdAt: string;
  group: { id: string; name: string };
}

const repeatLabels: Record<string, string> = {
  none: "1回のみ",
  daily: "毎日",
  weekly: "毎週",
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({
    groupId: "",
    startTime: "",
    endTime: "",
    repeat: "none",
    priority: 0,
  });
  const [creating, setCreating] = useState(false);

  // 即時公開フォーム
  const [broadcast, setBroadcast] = useState({ groupId: "", priority: 0 });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const load = () =>
    fetch("/api/schedules")
      .then((r) => r.json())
      .then(setSchedules);

  useEffect(() => {
    load();
    fetch("/api/groups")
      .then((r) => r.json())
      .then(setGroups);
  }, []);

  const defaultStartTime = () => {
    const d = new Date(Date.now() + 60000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupId || !form.startTime) return;
    setCreating(true);
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: form.groupId,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
        repeat: form.repeat,
        priority: form.priority,
      }),
    });
    setForm({ groupId: "", startTime: "", endTime: "", repeat: "none", priority: 0 });
    setCreating(false);
    load();
  };

  const handleToggle = async (s: Schedule) => {
    await fetch(`/api/schedules/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このスケジュールを削除しますか？")) return;
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    load();
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.groupId) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: broadcast.groupId, priority: broadcast.priority }),
      });
      if (res.ok) {
        const group = groups.find((g) => g.id === broadcast.groupId);
        setBroadcastResult(`「${group?.name ?? broadcast.groupId}」を配信しました`);
      } else {
        setBroadcastResult("配信に失敗しました");
      }
    } catch {
      setBroadcastResult("通信エラーが発生しました");
    }
    setBroadcasting(false);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">スケジュール管理</h2>

      {/* 即時公開 */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-1">即時公開</h3>
        <p className="text-sm text-gray-500 mb-5">
          スケジュールを作成せず、今すぐ全ディスプレイに配信します。
        </p>
        <form onSubmit={handleBroadcast} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              グループ
            </label>
            <select
              value={broadcast.groupId}
              onChange={(e) => setBroadcast({ ...broadcast, groupId: e.target.value })}
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">グループを選択</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              優先度
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={broadcast.priority}
              onChange={(e) =>
                setBroadcast({ ...broadcast, priority: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={broadcasting || !broadcast.groupId}
            className="px-6 py-3 bg-green-600 text-white text-base font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {broadcasting ? "配信中..." : "今すぐ配信"}
          </button>
        </form>

        {broadcastResult && (
          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg">
              {broadcastResult}
            </p>
            <button
              onClick={() => setBroadcastResult(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* 新規スケジュール作成フォーム */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-5">
          新規スケジュール
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              グループ
            </label>
            <select
              value={form.groupId}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">グループを選択</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              開始時刻
            </label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              onClick={(e) => {
                if (!form.startTime) {
                  setForm({ ...form, startTime: defaultStartTime() });
                }
                (e.target as HTMLInputElement).showPicker?.();
              }}
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              終了時刻
              <span className="ml-2 text-xs font-normal text-gray-400">
                （任意 — 繰り返しの場合、この時刻以降は停止）
              </span>
            </label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              onClick={(e) => {
                (e.target as HTMLInputElement).showPicker?.();
              }}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              繰り返し
            </label>
            <select
              value={form.repeat}
              onChange={(e) => setForm({ ...form, repeat: e.target.value })}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="none">1回のみ</option>
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              優先度（高いほど割り込み優先）
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "作成中..." : "スケジュール作成"}
            </button>
          </div>
        </form>
      </div>

      {/* スケジュール一覧 */}
      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">スケジュールがありません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  状態
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  グループ
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  開始時刻
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  終了時刻
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  繰り返し
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  優先度
                </th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
                    !s.active ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block px-3 py-1.5 rounded-full text-sm font-semibold ${
                        s.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.active ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-base font-medium text-gray-800">
                    {s.group.name}
                  </td>
                  <td className="px-5 py-4 text-base text-gray-700">
                    {new Date(s.startTime).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {s.endTime
                      ? new Date(s.endTime).toLocaleString("ja-JP")
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {repeatLabels[s.repeat] ?? s.repeat}
                  </td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {s.priority}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleToggle(s)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
                      >
                        {s.active ? "無効化" : "有効化"}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors border border-red-200"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
