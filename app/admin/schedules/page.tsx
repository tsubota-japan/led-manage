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
    repeat: "none",
    priority: 0,
  });
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupId || !form.startTime) return;
    setCreating(true);
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
      }),
    });
    setForm({ groupId: "", startTime: "", repeat: "none", priority: 0 });
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

  // Default startTime: now + 1 minute
  const defaultStartTime = () => {
    const d = new Date(Date.now() + 60000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">スケジュール管理</h2>

      {/* Create form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          新規スケジュール
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">グループ</label>
            <select
              value={form.groupId}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            <label className="block text-xs text-gray-500 mb-1">開始時刻</label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              onClick={(e) => {
                if (!form.startTime) {
                  setForm({
                    ...form,
                    startTime: defaultStartTime(),
                  });
                }
                (e.target as HTMLInputElement).showPicker?.();
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">繰り返し</label>
            <select
              value={form.repeat}
              onChange={(e) => setForm({ ...form, repeat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="none">1回のみ</option>
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "作成中..." : "スケジュール作成"}
            </button>
          </div>
        </form>
      </div>

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-dashed border-gray-300">
          スケジュールがありません
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  状態
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  グループ
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  開始時刻
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  繰り返し
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  優先度
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-gray-100 last:border-0 ${
                    !s.active ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        s.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.active ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{s.group.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(s.startTime).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {repeatLabels[s.repeat] ?? s.repeat}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.priority}</td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <button
                      onClick={() => handleToggle(s)}
                      className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-100"
                    >
                      {s.active ? "無効化" : "有効化"}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                    >
                      削除
                    </button>
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
