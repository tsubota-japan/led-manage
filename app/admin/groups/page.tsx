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
      <h2 className="text-2xl font-semibold text-gray-900 page-title mb-12">グループ管理</h2>

      <form onSubmit={handleCreate} className="flex gap-3" style={{ marginBottom: "40px" }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="グループ名を入力"
          className="form-input flex-1"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="btn-primary"
        >
          作成
        </button>
      </form>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl text-center border border-gray-200" style={{ padding: "64px" }}>
          <p className="text-gray-500 text-lg">
            グループがありません。上のフォームから作成してください。
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full admin-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  グループ名
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  ファイル数
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  作成日
                </th>
                <th className="px-8 py-6" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-8 py-6 text-base font-semibold text-gray-800">
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-8 py-6 text-base text-gray-600">
                    {g._count.groupFiles} 件
                  </td>
                  <td className="px-8 py-6 text-base text-gray-600">
                    {new Date(g.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/groups/${g.id}`}
                        className="btn-edit"
                      >
                        編集
                      </Link>
                      <button
                        onClick={() => handleDelete(g.id, g.name)}
                        className="btn-danger"
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
