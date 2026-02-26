"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

interface Props {
  code: string;
}

export default function DisplayPlayer({ code }: Props) {
  const [items, setItems] = useState<GroupFile[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"waiting" | "playing" | "error">(
    "waiting"
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const advance = useCallback((currentItems: GroupFile[]) => {
    setIndex((prev) => {
      const next = (prev + 1) % currentItems.length;
      return next;
    });
  }, []);

  // Load group and start playing
  const loadGroup = useCallback(
    async (groupId: string) => {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        const group = await res.json();
        const gFiles: GroupFile[] = group.groupFiles ?? [];
        if (gFiles.length === 0) return;

        clearTimer();
        setItems(gFiles);
        setIndex(0);
        setStatus("playing");
      } catch (err) {
        console.error("Failed to load group:", err);
        setStatus("error");
      }
    },
    []
  );

  // SSE connection
  useEffect(() => {
    const eventSource = new EventSource(`/api/sse/${code}`);

    eventSource.onmessage = (e) => {
      try {
        const { groupId } = JSON.parse(e.data);
        loadGroup(groupId);
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      setStatus("error");
    };

    return () => {
      eventSource.close();
    };
  }, [code, loadGroup]);

  // Handle display of current item
  useEffect(() => {
    if (status !== "playing" || items.length === 0) return;

    const item = items[index];
    if (!item) return;

    clearTimer();

    const isImage = item.file.mimeType.startsWith("image/");
    const isVideo = item.file.mimeType.startsWith("video/");

    if (isImage) {
      const duration = item.duration ?? 15;
      timerRef.current = setTimeout(() => {
        advance(items);
      }, duration * 1000);
    }
    // Videos are handled by onEnded event

    return clearTimer;
  }, [index, items, status, advance]);

  if (status === "waiting") {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-gray-500 text-sm">
        <div className="text-center">
          <div className="text-4xl mb-4">📺</div>
          <p>スタンバイ中...</p>
          <p className="text-xs mt-2 font-mono text-gray-600">{code}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-red-500 text-sm">
        <div className="text-center">
          <p>接続エラー</p>
          <p className="text-xs mt-2 font-mono text-gray-600">{code}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-gray-500 text-sm">
        再生するコンテンツがありません
      </div>
    );
  }

  const current = items[index];
  if (!current) return null;

  const isVideo = current.file.mimeType.startsWith("video/");
  const isImage = current.file.mimeType.startsWith("image/");

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={current.file.path}
          alt={current.file.name}
          className="max-w-full max-h-full object-contain"
        />
      )}
      {isVideo && (
        <video
          key={current.id}
          ref={videoRef}
          src={current.file.path}
          autoPlay
          muted
          playsInline
          className="max-w-full max-h-full object-contain"
          onEnded={() => advance(items)}
          onError={() => advance(items)}
        />
      )}
    </div>
  );
}
