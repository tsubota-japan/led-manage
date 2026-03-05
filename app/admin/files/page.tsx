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

interface RenameState {
  id: string;
  basename: string;
  ext: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [renaming, setRenaming] = useState<RenameState | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<FileRecord | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
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
    const VIDEO_EXTS = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"];
    const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".heic", ".heif"];
    const MAX_SIZE = 500 * 1024 * 1024;

    const all = Array.from(fileList);
    const oversized = all.filter((f) => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      setSizeError(
        `ファイルサイズは500MB以内にしてください。以下のファイルは追加できません：\n${oversized.map((f) => `・${f.name}（${(f.size / 1024 / 1024).toFixed(1)} MB）`).join("\n")}`
      );
    } else {
      setSizeError(null);
    }

    const accepted = all.filter((f) => {
      if (f.size > MAX_SIZE) return false;
      if (f.type.startsWith("image/") || f.type.startsWith("video/")) return true;
      // MIMEタイプが取得できない場合は拡張子で判定
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext);
    });
    if (accepted.length === 0) return;

    const newStaged: StagedFile[] = accepted.map((file) => {
      const { basename, ext } = splitExt(file.name);
      const extLower = ext.toLowerCase();
      const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".heic", ".heif"];
      const isImage = file.type.startsWith("image/") || IMAGE_EXTS.includes(extLower);
      const preview = isImage ? URL.createObjectURL(file) : null;
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

  // 1チャンクの最大サイズ（8MB）。Codespaces等のプロキシ制限を回避
  const CHUNK_SIZE = 8 * 1024 * 1024;

  const uploadSingle = async (file: File, displayName: string): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    form.append("name", displayName);
    const res = await fetch("/api/files", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error ?? `サーバーエラー (${res.status})`;
    }
    return null;
  };

  const uploadChunked = async (file: File, displayName: string): Promise<string | null> => {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const form = new FormData();
      form.append("chunk", chunk);
      form.append("uploadId", uploadId);
      form.append("chunkIndex", String(i));
      form.append("totalChunks", String(totalChunks));

      const res = await fetch("/api/files/chunks", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.error ?? `チャンク ${i + 1}/${totalChunks} の送信に失敗しました`;
      }
    }

    const res = await fetch("/api/files/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        displayName,
        mimeType: file.type,
        totalChunks,
        totalSize: file.size,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error ?? `ファイル結合に失敗しました (${res.status})`;
    }
    return null;
  };

  // ステージングされたファイルをアップロード
  const handleUpload = async () => {
    if (staged.length === 0) return;
    setUploading(true);
    setUploadErrors([]);
    setProgress({ current: 0, total: staged.length });

    const errors: string[] = [];

    for (let i = 0; i < staged.length; i++) {
      const { file, basename, ext } = staged[i];
      setProgress({ current: i + 1, total: staged.length });

      const displayName = basename.trim() ? `${basename.trim()}${ext}` : file.name;

      if (file.size > 500 * 1024 * 1024) {
        errors.push(`${file.name}: ファイルサイズは500MB以内にしてください`);
        continue;
      }

      try {
        // 8MB 超はチャンク分割アップロード（プロキシの制限を回避）
        const error = file.size > CHUNK_SIZE
          ? await uploadChunked(file, displayName)
          : await uploadSingle(file, displayName);
        if (error) errors.push(`${file.name}: ${error}`);
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "通信エラー"}`);
      }
    }

    staged.forEach((s) => { if (s.preview) URL.revokeObjectURL(s.preview); });
    setStaged([]);
    setUploading(false);
    setProgress(null);
    if (errors.length > 0) setUploadErrors(errors);
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" を削除しますか？`)) return;
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    load();
  };

  const startRename = (f: FileRecord) => {
    const { basename, ext } = splitExt(f.name);
    setRenaming({ id: f.id, basename, ext });
  };

  const handleRename = async () => {
    if (!renaming) return;
    const newName = renaming.basename.trim()
      ? `${renaming.basename.trim()}${renaming.ext}`
      : null;
    if (!newName) { setRenaming(null); return; }
    await fetch(`/api/files/${renaming.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setRenaming(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "40px" }}>
        <h2 className="text-2xl font-semibold text-gray-900">ファイル管理</h2>
        <label
          className="btn-primary cursor-pointer"
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

      {/* アップロードエラー */}
      {uploadErrors.length > 0 && (
        <div className="mb-4 px-8 py-6 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <span className="text-red-500 text-xl shrink-0">⚠</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 mb-1">アップロードに失敗したファイルがあります</p>
            {uploadErrors.map((msg, i) => (
              <p key={i} className="text-sm text-red-700">{msg}</p>
            ))}
          </div>
          <button
            onClick={() => setUploadErrors([])}
            className="text-red-400 hover:text-red-600 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* サイズエラー */}
      {sizeError && (
        <div className="mb-4 px-8 py-6 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <span className="text-red-500 text-xl shrink-0">⚠</span>
          <div className="flex-1">
            {sizeError.split("\n").map((line, i) => (
              <p key={i} className="text-sm text-red-700">{line}</p>
            ))}
          </div>
          <button
            onClick={() => setSizeError(null)}
            className="text-red-400 hover:text-red-600 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* ドロップゾーン */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !uploading && staged.length === 0 && inputRef.current?.click()}
        className={`mb-6 rounded-xl border-2 border-dashed transition-colors ${
          isDragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50/50"
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
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-gray-700">
                ファイル名を確認・編集してからアップロード
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
            <p className="text-sm text-gray-400 mb-4">
              名前は変更しなくてもOKです。同名ファイルが既にある場合は自動で連番が付きます。
            </p>

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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={s.basename}
                        onChange={(e) => updateBasename(i, e.target.value)}
                        className="form-input flex-1 min-w-0"
                        placeholder={s.basename}
                      />
                      {s.ext && (
                        <span className="text-base text-gray-500 font-mono shrink-0">
                          {s.ext}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 pl-1">
                      元のファイル名: {s.file.name}
                    </p>
                  </div>

                  {/* サイズ */}
                  <span className={`text-sm shrink-0 ${s.file.size > 500 * 1024 * 1024 ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                    {formatBytes(s.file.size)}
                    {s.file.size > 500 * 1024 * 1024 && " ⚠ 500MB超"}
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
                className="btn-primary"
              >
                アップロード開始（{staged.length}件）
              </button>
              <button
                onClick={cancelStaging}
                className="btn-secondary"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ファイル一覧 */}
      {files.length === 0 ? (
        <div className="bg-white rounded-xl text-center border border-gray-200" style={{ padding: "64px" }}>
          <p className="text-gray-400 text-base">
            アップロードされたファイルがありません
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full admin-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  プレビュー
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  ファイル名
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  種類
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  サイズ
                </th>
                <th className="px-8 py-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  登録日
                </th>
                <th className="px-8 py-6" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-8 py-6">
                    <button
                      onClick={() => setPreviewing(f)}
                      className="block focus:outline-none"
                      title="クリックしてプレビュー"
                    >
                      {f.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.path}
                          alt={f.name}
                          className="w-20 h-12 object-cover rounded-lg hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-20 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-500 font-medium hover:bg-gray-200 transition-colors">
                          ▶ 動画
                        </div>
                      )}
                    </button>
                  </td>
                  <td className="px-8 py-6">
                    {renaming?.id === f.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          autoFocus
                          value={renaming.basename}
                          onChange={(e) =>
                            setRenaming({ ...renaming, basename: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          className="form-input flex-1 min-w-0"
                        />
                        {renaming.ext && (
                          <span className="text-base text-gray-500 font-mono shrink-0">
                            {renaming.ext}
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setPreviewing(f)}
                        className="text-base text-gray-800 font-medium hover:text-blue-600 transition-colors text-left"
                      >
                        {f.name}
                      </button>
                    )}
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-500">
                    {f.mimeType}
                  </td>
                  <td className="px-8 py-6 text-base text-gray-600">
                    {formatBytes(f.size)}
                  </td>
                  <td className="px-8 py-6 text-base text-gray-600">
                    {new Date(f.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex gap-2 justify-end">
                      {renaming?.id === f.id ? (
                        <>
                          <button
                            onClick={handleRename}
                            className="btn-primary"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setRenaming(null)}
                            className="btn-secondary"
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startRename(f)}
                            className="btn-edit"
                          >
                            リネーム
                          </button>
                          <button
                            onClick={() => handleDelete(f.id, f.name)}
                            className="btn-danger"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* プレビューモーダル */}
      {previewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="relative max-w-4xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              onClick={() => setPreviewing(null)}
              className="absolute -top-10 right-0 text-white text-3xl leading-none hover:text-gray-300"
            >
              ×
            </button>

            {/* ファイル名 */}
            <p className="text-white text-sm font-medium mb-2 truncate">
              {previewing.name}
            </p>

            {/* コンテンツ */}
            {previewing.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewing.path}
                alt={previewing.name}
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            ) : (
              <video
                src={previewing.path}
                controls
                autoPlay
                className="w-full max-h-[80vh] rounded-xl bg-black"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
