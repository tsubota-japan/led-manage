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
      <h2 className="text-2xl font-bold text-gray-800 mb-6">グループ管理</h2>

      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="グループ名"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          作成
        </button>
      </form>

      {groups.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-dashed border-gray-300">
          グループがありません。上のフォームから作成してください。
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  グループ名
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  ファイル数
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  作成日
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {g._count.groupFiles} 件
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(g.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded hover:bg-blue-50"
                    >
                      編集
                    </Link>
                    <button
                      onClick={() => handleDelete(g.id, g.name)}
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
