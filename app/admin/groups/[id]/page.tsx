"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FileRecord {
  id: string;
  name: string;
  path: string;
  mimeType: string;
}

interface GroupFile {
  id: string;
  fileId: string;
  order: number;
  duration: number | null;
  file: FileRecord;
}

interface Group {
  id: string;
  name: string;
  groupFiles: GroupFile[];
}

function SortableItem({
  gf,
  isSelected,
  onToggleSelect,
  onDurationChange,
  onRemove,
}: {
  gf: GroupFile;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDurationChange: (id: string, val: number | null) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: gf.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isImage = gf.file.mimeType.startsWith("image/");

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, padding: "16px 20px", marginBottom: "10px" }}
      className={`flex items-center gap-4 border rounded-xl shadow-sm transition-colors ${
        isSelected
          ? "bg-red-50 border-red-300 ring-1 ring-red-200"
          : "bg-white border-gray-200"
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(gf.id)}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-gray-300 text-red-700 cursor-pointer shrink-0 accent-red-700"
      />

      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 text-2xl px-1 select-none"
        title="ドラッグして並び替え"
      >
        ⠿
      </button>

      {gf.file.mimeType.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gf.file.path}
          alt={gf.file.name}
          className="w-20 h-12 object-cover rounded-lg"
        />
      ) : (
        <div className="w-20 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-500 font-medium">
          動画
        </div>
      )}

      <span className="flex-1 text-base text-gray-800 font-medium truncate">
        {gf.file.name}
      </span>

      {isImage && (
        <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
          <span className="font-medium">表示秒数</span>
          <input
            type="number"
            min={1}
            max={3600}
            value={gf.duration ?? ""}
            placeholder="15"
            onChange={(e) =>
              onDurationChange(
                gf.id,
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            className="form-input"
            style={{ width: "80px" }}
          />
          <span>秒</span>
        </label>
      )}

      <button onClick={() => onRemove(gf.id)} className="btn-danger shrink-0">
        削除
      </button>
    </div>
  );
}

export default function GroupEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [allFiles, setAllFiles] = useState<FileRecord[]>([]);
  const [items, setItems] = useState<GroupFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${id}`).then((r) => r.json()),
      fetch("/api/files").then((r) => r.json()),
    ]).then(([g, files]) => {
      setGroup(g);
      setGroupName(g.name);
      setItems(g.groupFiles);
      setAllFiles(files);
      setSelectedIds(new Set());
    });
  }, [id]);

  const handleToggleSelect = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setItems((prev) => {
      const isMultiDrag = selectedIds.has(activeId) && selectedIds.size > 1;

      if (!isMultiDrag) {
        const oldIndex = prev.findIndex((i) => i.id === activeId);
        const newIndex = prev.findIndex((i) => i.id === overId);
        return arrayMove(prev, oldIndex, newIndex);
      }

      const activeIndex = prev.findIndex((i) => i.id === activeId);
      const overIndex = prev.findIndex((i) => i.id === overId);
      const selected = prev.filter((i) => selectedIds.has(i.id));
      const remaining = prev.filter((i) => !selectedIds.has(i.id));

      let insertAt: number;
      if (selectedIds.has(overId)) {
        insertAt = prev.slice(0, overIndex).filter((i) => !selectedIds.has(i.id)).length;
      } else {
        const overInRemaining = remaining.findIndex((i) => i.id === overId);
        insertAt = overIndex > activeIndex ? overInRemaining + 1 : overInRemaining;
      }

      const result = [...remaining];
      result.splice(insertAt, 0, ...selected);
      return result;
    });
  };

  const handleDurationChange = (gfId: string, val: number | null) => {
    setItems((prev) =>
      prev.map((i) => (i.id === gfId ? { ...i, duration: val } : i))
    );
  };

  const handleRemove = (gfId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== gfId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(gfId);
      return next;
    });
  };

  const handleAddFile = (fileId: string) => {
    const file = allFiles.find((f) => f.id === fileId);
    if (!file) return;
    const newItem: GroupFile = {
      id: `new-${Date.now()}-${fileId}`,
      fileId,
      order: items.length,
      duration: null,
      file,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleSave = async () => {
    setSaving(true);

    if (groupName !== group?.name) {
      await fetch(`/api/groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      });
    }

    await fetch(`/api/groups/${id}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ fileId: i.fileId, duration: i.duration })),
      }),
    });

    setSaving(false);
    router.push("/admin/groups");
  };

  if (!group) return <p className="text-gray-500 text-base">読み込み中...</p>;

  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && selectedCount === items.length;

  return (
    <div className="max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-4" style={{ marginBottom: "40px" }}>
        <button onClick={() => router.push("/admin/groups")} className="btn-secondary">
          ← 戻る
        </button>
        <h2 className="text-2xl font-semibold text-gray-900">グループ編集</h2>
      </div>

      {/* グループ名 */}
      <div style={{ marginBottom: "36px" }}>
        <label className="block text-sm font-semibold text-gray-600" style={{ marginBottom: "8px" }}>
          グループ名
        </label>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="form-input"
        />
      </div>

      {/* ファイルを追加 */}
      <div style={{ marginBottom: "36px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <label className="text-sm font-semibold text-gray-600">
            ファイルを追加
            <span className="ml-2 text-xs font-normal text-gray-400">（クリックで追加）</span>
          </label>
          <input
            type="text"
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            placeholder="ファイル名で絞り込み..."
            className="form-input"
            style={{ width: "200px" }}
          />
        </div>

        {allFiles.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-200 rounded-xl">
            アップロードされたファイルがありません
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl bg-gray-50 max-h-72 overflow-y-auto" style={{ padding: "12px" }}>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {allFiles
                .filter((f) =>
                  fileSearch === "" ||
                  f.name.toLowerCase().includes(fileSearch.toLowerCase())
                )
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleAddFile(f.id)}
                    title={f.name}
                    className="group relative flex flex-col rounded-lg overflow-hidden border-2 border-transparent hover:border-red-500 hover:shadow-md transition-all bg-white focus:outline-none focus:border-red-500"
                  >
                    {f.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.path}
                        alt={f.name}
                        className="w-full aspect-video object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-gray-200 flex flex-col items-center justify-center gap-1">
                        <span className="text-2xl">▶</span>
                        <span className="text-xs text-gray-500 font-medium">動画</span>
                      </div>
                    )}
                    <div className="px-1.5 py-1.5 w-full">
                      <p className="text-xs text-gray-700 truncate leading-tight">{f.name}</p>
                    </div>
                    <div className="absolute inset-0 bg-red-700/0 group-hover:bg-red-700/10 transition-colors" />
                    <div className="absolute top-1 right-1 w-5 h-5 bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                      <span className="text-white text-xs font-bold leading-none">＋</span>
                    </div>
                  </button>
                ))}
            </div>
            {allFiles.filter((f) =>
              fileSearch === "" ||
              f.name.toLowerCase().includes(fileSearch.toLowerCase())
            ).length === 0 && (
              <p className="text-center text-gray-400 text-sm py-6">
                「{fileSearch}」に一致するファイルがありません
              </p>
            )}
          </div>
        )}
      </div>

      {/* 再生順 */}
      <div style={{ marginBottom: "40px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <h3 className="text-sm font-semibold text-gray-600">
            再生順
            <span className="ml-2 text-xs font-normal text-gray-400">
              （チェックで複数選択 → ドラッグで一括移動）
            </span>
          </h3>

          {items.length > 0 && (
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <span className="text-sm font-medium text-red-700 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
                  {selectedCount}個選択中
                </span>
              )}
              <button
                onClick={allSelected ? handleDeselectAll : handleSelectAll}
                className="btn-secondary"
                style={{ padding: "7px 16px", fontSize: "13px" }}
              >
                {allSelected ? "選択解除" : "全選択"}
              </button>
              {selectedCount > 0 && !allSelected && (
                <button
                  onClick={handleDeselectAll}
                  className="btn-secondary"
                  style={{ padding: "7px 16px", fontSize: "13px" }}
                >
                  選択解除
                </button>
              )}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-base py-10 border-2 border-dashed border-gray-300 rounded-xl">
            ファイルが追加されていません
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((gf) => (
                <SortableItem
                  key={gf.id}
                  gf={gf}
                  isSelected={selectedIds.has(gf.id)}
                  onToggleSelect={handleToggleSelect}
                  onDurationChange={handleDurationChange}
                  onRemove={handleRemove}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 保存・キャンセル */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "保存中..." : "保存"}
        </button>
        <button onClick={() => router.push("/admin/groups")} className="btn-secondary">
          キャンセル
        </button>
      </div>
    </div>
  );
}
