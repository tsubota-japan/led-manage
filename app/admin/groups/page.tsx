"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Group {
  id: string;
  name: string;
  createdAt: string;
  _count: { groupFiles: number };
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () =>
    fetch("/api/groups")
      .then((r) => r.json())
      .then(setGroups);

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" を削除しますか？`)) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">グループ管理</h2>

      <form onSubmit={handleCreate} className="flex gap-3 mb-8">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="グループ名を入力"
          className="flex-1 px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          作成
        </button>
      </form>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">
            グループがありません。上のフォームから作成してください。
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  グループ名
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  ファイル数
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  作成日
                </th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-4 text-base font-semibold text-gray-800">
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {g._count.groupFiles} 件
                  </td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {new Date(g.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/groups/${g.id}`}
                        className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors border border-blue-200"
                      >
                        編集
                      </Link>
                      <button
                        onClick={() => handleDelete(g.id, g.name)}
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
