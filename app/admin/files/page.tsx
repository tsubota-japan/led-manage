"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const load = () =>
    fetch("/api/files")
      .then((r) => r.json())
      .then(setFiles);

  useEffect(() => {
    load();
  }, []);

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const selected = Array.from(fileList).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (selected.length === 0) return;

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
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (uploading) return;
    const dropped = e.dataTransfer.files;
    if (dropped.length > 0) uploadFiles(dropped);
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
        <label
          className={`px-5 py-3 text-base font-medium rounded-lg cursor-pointer transition-colors ${
            uploading
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          ＋ ファイルを追加
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleInputChange}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`mb-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
        } ${uploading ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {uploading ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-base font-medium text-blue-700">{progress}</p>
          </div>
        ) : isDragOver ? (
          <div className="px-6 py-10 text-center">
            <div className="text-5xl mb-3">📂</div>
            <p className="text-lg font-semibold text-blue-600">
              ここにドロップしてアップロード
            </p>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-3">🖼️</div>
            <p className="text-base font-medium text-gray-600">
              ここにファイルをドラッグ＆ドロップ
            </p>
            <p className="text-sm text-gray-400 mt-1">
              またはクリックしてファイルを選択（画像・動画）
            </p>
          </div>
        )}
      </div>

      {files.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-gray-200">
          <p className="text-gray-400 text-base">
            アップロードされたファイルがありません
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
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {f.mimeType}
                  </td>
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
