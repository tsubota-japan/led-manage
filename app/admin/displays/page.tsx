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
      <h2 className="text-2xl font-semibold text-gray-900 page-title mb-12">ディスプレイ管理</h2>

      <form onSubmit={handleCreate} className="flex gap-3" style={{ marginBottom: "40px" }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ディスプレイ名を入力"
          className="form-input flex-1"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="btn-primary"
        >
          追加
        </button>
      </form>

      {displays.length === 0 ? (
        <div className="bg-white rounded-xl text-center border border-gray-200" style={{ padding: "64px" }}>
          <p className="text-gray-500 text-lg">ディスプレイが登録されていません</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full admin-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  状態
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  名前
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  コード
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  URL
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  登録日
                </th>
                <th className="px-8 py-6" />
              </tr>
            </thead>
            <tbody>
              {displays.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-8 py-6">
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
                  <td className="px-8 py-6 text-base font-semibold text-gray-800">
                    {d.name}
                  </td>
                  <td className="px-8 py-6 font-mono text-base text-gray-600">
                    {d.code}
                  </td>
                  <td className="px-8 py-6">
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
                        className={copied === d.code
                            ? "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors bg-green-100 text-green-700 border-green-300"
                            : "btn-secondary"}
                      >
                        {copied === d.code ? "✓ コピー済み" : "URLコピー"}
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-base text-gray-600">
                    {new Date(d.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDelete(d.id, d.name)}
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
