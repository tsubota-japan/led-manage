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
      <h2 className="text-3xl font-bold text-gray-800 mb-8">ディスプレイ管理</h2>

      <form onSubmit={handleCreate} className="flex gap-3 mb-8">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ディスプレイ名を入力"
          className="flex-1 px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          追加
        </button>
      </form>

      {displays.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">ディスプレイが登録されていません</p>
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
                  名前
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  コード
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  URL
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  登録日
                </th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {displays.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                        d.online
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          d.online ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {d.online ? "オンライン" : "オフライン"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-base font-semibold text-gray-800">
                    {d.name}
                  </td>
                  <td className="px-5 py-4 font-mono text-base text-gray-600">
                    {d.code}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/display/${d.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        /display/{d.code}
                      </a>
                      <button
                        onClick={() => copyUrl(d.code)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                          copied === d.code
                            ? "bg-green-100 text-green-700 border-green-300"
                            : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                        }`}
                      >
                        {copied === d.code ? "✓ コピー済み" : "URLコピー"}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {new Date(d.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDelete(d.id, d.name)}
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
