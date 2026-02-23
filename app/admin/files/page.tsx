"use client";

import { useEffect, useRef, useState } from "react";

interface FileRecord {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () =>
    fetch("/api/files")
      .then((r) => r.json())
      .then(setFiles);

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    setUploading(true);
    setProgress("");

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      setProgress(`アップロード中: ${file.name} (${i + 1}/${selected.length})`);
      const form = new FormData();
      form.append("file", file);
      await fetch("/api/files", { method: "POST", body: form });
    }

    setProgress("完了");
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" を削除しますか？`)) return;
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-800">ファイル管理</h2>
        <label className={`px-5 py-3 text-base font-medium rounded-lg cursor-pointer transition-colors ${
          uploading
            ? "bg-gray-400 text-white cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}>
          ＋ ファイルを追加
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {uploading && (
        <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-xl text-base border border-blue-200">
          {progress}
        </div>
      )}

      {files.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">
            ファイルがありません。上のボタンからアップロードしてください。
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  プレビュー
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  ファイル名
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  種類
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  サイズ
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  登録日
                </th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-4">
                    {f.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.path}
                        alt={f.name}
                        className="w-20 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-20 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-500 font-medium">
                        動画
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-base text-gray-800 font-medium">
                    {f.name}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">{f.mimeType}</td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {formatBytes(f.size)}
                  </td>
                  <td className="px-5 py-4 text-base text-gray-600">
                    {new Date(f.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleDelete(f.id, f.name)}
                      className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors border border-red-200"
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
