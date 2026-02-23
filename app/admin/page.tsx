"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Display {
  id: string;
  name: string;
  code: string;
  online: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/displays")
      .then((r) => r.json())
      .then(setDisplays)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
        <Link
          href="/admin/displays"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          ディスプレイ管理
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : displays.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-dashed border-gray-300">
          <p className="mb-3">ディスプレイが登録されていません</p>
          <Link
            href="/admin/displays"
            className="text-blue-600 hover:underline text-sm"
          >
            ディスプレイを追加する →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displays.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">{d.name}</h3>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    d.online ? "bg-green-500" : "bg-gray-300"
                  }`}
                  title={d.online ? "オンライン" : "オフライン"}
                />
              </div>
              <p className="text-xs text-gray-400 font-mono mb-3">
                コード: {d.code}
              </p>
              <a
                href={`/display/${d.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                表示画面を開く →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
