"use client";

import { useEffect, useState } from "react";

interface Display {
  id: string;
  name: string;
  code: string;
  online: boolean;
  createdAt: string;
}

export default function DisplaysPage() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () =>
    fetch("/api/displays")
      .then((r) => r.json())
      .then(setDisplays);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/displays", {
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
    await fetch(`/api/displays/${id}`, { method: "DELETE" });
    load();
  };

  const copyUrl = (code: string) => {
    const url = `${window.location.origin}/display/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">ディスプレイ管理</h2>

      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ディスプレイ名"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          追加
        </button>
      </form>

      {displays.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-dashed border-gray-300">
          ディスプレイが登録されていません
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
                  名前
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  コード
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  URL
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  登録日
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displays.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        d.online ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={d.online ? "オンライン" : "オフライン"}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {d.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500">
                    {d.code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/display/${d.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        /display/{d.code}
                      </a>
                      <button
                        onClick={() => copyUrl(d.code)}
                        className="text-gray-400 hover:text-gray-600 text-xs px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-400"
                      >
                        {copied === d.code ? "コピー済み" : "コピー"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(d.id, d.name)}
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
