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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">ファイル管理</h2>
        <label className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer hover:bg-blue-700">
          ファイルを追加
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
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          {progress}
        </div>
      )}

      {files.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-dashed border-gray-300">
          ファイルがありません。上のボタンからアップロードしてください。
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  プレビュー
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  ファイル名
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  種類
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  サイズ
                </th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">
                  登録日
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-2">
                    {f.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.path}
                        alt={f.name}
                        className="w-16 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                        動画
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-800">{f.name}</td>
                  <td className="px-4 py-2 text-gray-500">{f.mimeType}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {formatBytes(f.size)}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(f.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(f.id, f.name)}
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
