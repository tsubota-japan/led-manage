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

interface StagedFile {
  file: File;
  basename: string; // 編集可能な名前（拡張子なし）
  ext: string;      // 拡張子（固定）
  preview: string | null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function splitExt(filename: string): { basename: string; ext: string } {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return { basename: filename, ext: "" };
  return {
    basename: filename.slice(0, dotIndex),
    ext: filename.slice(dotIndex),
  };
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
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

  // ファイルを選択/ドロップ → ステージングに追加
  const stageFiles = (fileList: FileList | File[]) => {
    const accepted = Array.from(fileList).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (accepted.length === 0) return;

    const newStaged: StagedFile[] = accepted.map((file) => {
      const { basename, ext } = splitExt(file.name);
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      return { file, basename, ext, preview };
    });

    setStaged((prev) => [...prev, ...newStaged]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) stageFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (uploading) return;
    if (e.dataTransfer.files.length > 0) stageFiles(e.dataTransfer.files);
  };

  const updateBasename = (index: number, value: string) => {
    setStaged((prev) =>
      prev.map((s, i) => (i === index ? { ...s, basename: value } : s))
    );
  };

  const removeStaged = (index: number) => {
    setStaged((prev) => {
      const item = prev[index];
      if (item.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const cancelStaging = () => {
    staged.forEach((s) => { if (s.preview) URL.revokeObjectURL(s.preview); });
    setStaged([]);
  };

  // ステージングされたファイルをアップロード
  const handleUpload = async () => {
    if (staged.length === 0) return;
    setUploading(true);
    setProgress({ current: 0, total: staged.length });

    for (let i = 0; i < staged.length; i++) {
      const { file, basename, ext } = staged[i];
      setProgress({ current: i + 1, total: staged.length });

      const displayName = basename.trim() ? `${basename.trim()}${ext}` : file.name;
      const form = new FormData();
      form.append("file", file);
      form.append("name", displayName);
      await fetch("/api/files", { method: "POST", body: form });
    }

    staged.forEach((s) => { if (s.preview) URL.revokeObjectURL(s.preview); });
    setStaged([]);
    setUploading(false);
    setProgress(null);
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

      {/* ドロップゾーン */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !uploading && staged.length === 0 && inputRef.current?.click()}
        className={`mb-6 rounded-xl border-2 border-dashed transition-colors ${
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
        } ${uploading || staged.length > 0 ? "cursor-default" : "cursor-pointer"}`}
      >
        {uploading && progress ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-base font-medium text-blue-700">
              アップロード中: {progress.current} / {progress.total}
            </p>
            <div className="mt-3 mx-auto w-64 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : isDragOver ? (
          <div className="px-6 py-10 text-center pointer-events-none">
            <div className="text-5xl mb-3">📂</div>
            <p className="text-lg font-semibold text-blue-600">
              ここにドロップ
            </p>
          </div>
        ) : staged.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-3">🖼️</div>
            <p className="text-base font-medium text-gray-600">
              ここにファイルをドラッグ＆ドロップ
            </p>
            <p className="text-sm text-gray-400 mt-1">
              またはクリックしてファイルを選択（画像・動画）
            </p>
          </div>
        ) : (
          /* ステージングパネル */
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-semibold text-gray-700">
                アップロード前に名前を確認・編集できます
              </p>
              <label className="text-sm text-blue-600 hover:underline cursor-pointer font-medium">
                ＋ さらに追加
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleInputChange}
                />
              </label>
            </div>

            <div className="space-y-3 mb-5">
              {staged.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-gray-50 rounded-xl p-3 border border-gray-200"
                >
                  {/* プレビュー */}
                  {s.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.preview}
                      alt={s.file.name}
                      className="w-20 h-12 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-sm text-gray-500 font-medium shrink-0">
                      動画
                    </div>
                  )}

                  {/* 名前入力 */}
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    <input
                      type="text"
                      value={s.basename}
                      onChange={(e) => updateBasename(i, e.target.value)}
                      className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
                      placeholder="ファイル名"
                    />
                    {s.ext && (
                      <span className="text-base text-gray-500 font-mono shrink-0">
                        {s.ext}
                      </span>
                    )}
                  </div>

                  {/* サイズ */}
                  <span className="text-sm text-gray-400 shrink-0">
                    {formatBytes(s.file.size)}
                  </span>

                  {/* 削除 */}
                  <button
                    onClick={() => removeStaged(i)}
                    className="px-3 py-2 text-gray-400 hover:text-red-500 text-xl leading-none rounded-lg hover:bg-red-50 transition-colors shrink-0"
                    title="取り消し"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                className="px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                アップロード開始（{staged.length}件）
              </button>
              <button
                onClick={cancelStaging}
                className="px-6 py-3 bg-gray-100 text-gray-700 text-base font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ファイル一覧 */}
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
