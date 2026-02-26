"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Interfaces ──────────────────────────────────────────────────────
interface Group {
  id: string;
  name: string;
}

interface Schedule {
  id: string;
  groupId: string;
  startTime: string;
  endTime: string | null;
  repeat: string;
  priority: number;
  active: boolean;
  createdAt: string;
  group: { id: string; name: string };
}

interface ScheduleSlot {
  schedule: Schedule;
  displayStartMin: number;   // minutes from selectedDay 00:00, clamped ≥ 0
  displayEndMin: number | null;  // minutes from selectedDay 00:00, clamped ≤ 27*60
  lane: number;
  crossDayStart: boolean;
  color: string;
}

interface DragState {
  scheduleId: string;
  originalStartTime: Date;
  originalEndTime: Date | null;
  startX: number;
  currentOffsetMin: number;
}

// ── Constants ───────────────────────────────────────────────────────
const GROUP_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

const HOUR_WIDTH    = 80;   // px per hour
const LANE_HEIGHT   = 34;   // px per lane slot
const LABEL_WIDTH   = 160;  // px for sticky group name column
const SNAP_MINUTES  = 15;
const MIN_BAR_WIDTH = 40;   // px
const TOTAL_HOURS   = 27;   // canvas: 00:00 – 27:00
const TOP_PADDING   = 6;    // px top/bottom padding inside a row

// ── Label helpers ───────────────────────────────────────────────────
const repeatLabels: Record<string, string> = {
  none: "1回のみ", daily: "毎日", weekly: "毎週", always: "常時配信",
};

function priorityBadge(p: number): { cls: string; label: string } {
  if (p >= 10) return { cls: "bg-red-100 text-red-700 border border-red-200",    label: `${p} 緊急` };
  if (p >= 5)  return { cls: "bg-orange-100 text-orange-700 border border-orange-200", label: `${p} 高` };
  if (p >= 1)  return { cls: "bg-blue-100 text-blue-700 border border-blue-200",   label: `${p} 中` };
  return             { cls: "bg-gray-100 text-gray-600 border border-gray-200",    label: `${p} 通常` };
}

function relativeTime(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return "発火済み";
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  if (hrs >= 24) return `${Math.floor(hrs / 24)}日後`;
  if (hrs > 0)   return `${hrs}時間${mins % 60}分後`;
  if (mins > 0)  return `${mins}分後`;
  return "間もなく";
}

// ── Timeline helpers ────────────────────────────────────────────────
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function formatMin(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hourLabel(h: number): string {
  return h < 24 ? `${h}:00` : `${h - 24}(+1)`;
}

function priorityBorderColor(priority: number, groupColor: string): string {
  if (priority >= 10) return "#ef4444";
  if (priority >= 5)  return "#f97316";
  return groupColor;
}

/**
 * Build display slots for `date`.
 * - repeat=none  : show if startTime is on date, or prev-day start with endTime in [0, 3h]
 * - repeat=daily : always show (use time-of-day)
 * - repeat=weekly: show if day-of-week matches
 * endTime within 24h of startTime → bar end; otherwise treat as cutoff date → no bar end.
 */
function getSlotsForDate(
  schedules: Schedule[],
  date: Date,
  groupColorMap: Map<string, string>,
): ScheduleSlot[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayOf = dayStart.getTime();

  const slots: ScheduleSlot[] = [];

  for (const s of schedules) {
    const st = new Date(s.startTime);
    const et = s.endTime ? new Date(s.endTime) : null;

    let rawStartMin = 0;
    let rawEndMin: number | null = null;
    let include = false;

    if (s.repeat === "none") {
      rawStartMin = (st.getTime() - dayOf) / 60000;
      rawEndMin   = et ? (et.getTime() - dayOf) / 60000 : null;
      if (rawStartMin >= 0 && rawStartMin < 24 * 60) {
        include = true;
      } else if (
        rawStartMin >= -24 * 60 && rawStartMin < 0 &&
        rawEndMin !== null && rawEndMin > 0 && rawEndMin <= 3 * 60
      ) {
        include = true;
      }
    } else if (s.repeat === "daily") {
      rawStartMin = st.getHours() * 60 + st.getMinutes();
      if (et) {
        const diffMs = et.getTime() - st.getTime();
        if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
          const endTod = et.getHours() * 60 + et.getMinutes();
          rawEndMin = endTod <= rawStartMin ? endTod + 24 * 60 : endTod;
        }
        // else: cutoff date → no bar end
      }
      include = true;
    } else if (s.repeat === "weekly") {
      if (st.getDay() === date.getDay()) {
        rawStartMin = st.getHours() * 60 + st.getMinutes();
        if (et) {
          const diffMs = et.getTime() - st.getTime();
          if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
            const endTod = et.getHours() * 60 + et.getMinutes();
            rawEndMin = endTod <= rawStartMin ? endTod + 24 * 60 : endTod;
          }
        }
        include = true;
      }
    }

    if (!include) continue;
    if (rawEndMin !== null && rawEndMin <= 0) continue;
    if (rawStartMin >= TOTAL_HOURS * 60) continue;

    const crossDayStart  = rawStartMin < 0;
    const displayStartMin = Math.max(0, rawStartMin);
    const displayEndMin   = rawEndMin !== null
      ? Math.min(rawEndMin, TOTAL_HOURS * 60)
      : null;
    const color = groupColorMap.get(s.groupId) ?? GROUP_COLORS[0];

    slots.push({ schedule: s, displayStartMin, displayEndMin, lane: 0, crossDayStart, color });
  }

  return slots;
}

/** Assign lanes in-place (greedy, per group). */
function assignLanes(slots: ScheduleSlot[]): void {
  const byGroup = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const gid = slot.schedule.groupId;
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid)!.push(slot);
  }
  for (const groupSlots of byGroup.values()) {
    groupSlots.sort((a, b) => a.displayStartMin - b.displayStartMin);
    const laneEnds: number[] = [];
    for (const slot of groupSlots) {
      const minWidthMin = MIN_BAR_WIDTH / (HOUR_WIDTH / 60);
      const endMin = slot.displayEndMin ?? slot.displayStartMin + minWidthMin;
      let placed = false;
      for (let i = 0; i < laneEnds.length; i++) {
        if (slot.displayStartMin >= laneEnds[i]) {
          slot.lane   = i;
          laneEnds[i] = endMin;
          placed      = true;
          break;
        }
      }
      if (!placed) {
        slot.lane = laneEnds.length;
        laneEnds.push(endMin);
      }
    }
  }
}

// ── Main Component ───────────────────────────────────────────────────
export default function SchedulesPage() {
  const [schedules, setSchedules]       = useState<Schedule[]>([]);
  const [groups, setGroups]             = useState<Group[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [form, setForm] = useState({
    groupId: "", startTime: "", endTime: "", repeat: "none", priority: 0,
  });
  const [creating, setCreating] = useState(false);

  // View
  const [view, setView]               = useState<"list" | "timeline">("list");
  const [timelineDate, setTimelineDate] = useState(() => new Date());
  const [dragState, setDragState]      = useState<DragState | null>(null);
  const dragRef                        = useRef<DragState | null>(null);
  const [now, setNow]                  = useState(() => new Date());
  const scrollRef                      = useRef<HTMLDivElement | null>(null);

  // Broadcast
  const [broadcast, setBroadcast] = useState({ groupId: "", priority: 0 });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    type: "success" | "blocked" | "none" | "error";
    message: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────
  const load = useCallback(() =>
    fetch("/api/schedules").then(r => r.json()).then(setSchedules), []);

  const loadConnectedCount = useCallback(() =>
    fetch("/api/broadcasts").then(r => r.json())
      .then(d => setConnectedCount(d.connectedCount ?? 0)).catch(() => {}), []);

  useEffect(() => {
    load();
    fetch("/api/groups").then(r => r.json()).then(setGroups);
    loadConnectedCount();
    const timer = setInterval(loadConnectedCount, 5000);
    return () => clearInterval(timer);
  }, [load, loadConnectedCount]);

  // Clock tick (30s) for current-time line
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll to current time when opening timeline for today
  useEffect(() => {
    if (view !== "timeline" || !scrollRef.current) return;
    if (!isSameDay(timelineDate, new Date())) return;
    const n = new Date();
    const minFromMidnight = n.getHours() * 60 + n.getMinutes();
    scrollRef.current.scrollLeft = Math.max(0, (minFromMidnight / 60) * HOUR_WIDTH - 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]); // only on view open

  // ── Drag logic ───────────────────────────────────────────────────
  useEffect(() => {
    if (!dragState) return;

    const onMove = (e: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const deltaX  = e.clientX - state.startX;
      const rawMin  = (deltaX / HOUR_WIDTH) * 60;
      const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
      const updated: DragState = { ...state, currentOffsetMin: snapped };
      dragRef.current = updated;
      setDragState(updated);
    };

    const onUp = async () => {
      const state = dragRef.current;
      if (!state) return;
      const { scheduleId, originalStartTime, originalEndTime, currentOffsetMin } = state;
      dragRef.current = null;
      setDragState(null);
      if (currentOffsetMin === 0) return;
      const offsetMs = currentOffsetMin * 60000;
      const body: { startTime: string; endTime?: string } = {
        startTime: new Date(originalStartTime.getTime() + offsetMs).toISOString(),
      };
      if (originalEndTime) {
        body.endTime = new Date(originalEndTime.getTime() + offsetMs).toISOString();
      }
      await fetch(`/api/schedules/${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      load();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState?.scheduleId, load]);

  // ── Form handlers ────────────────────────────────────────────────
  const defaultStartTime = () => {
    const d = new Date(Date.now() + 60000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupId || !form.startTime) return;
    setCreating(true);
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId:   form.groupId,
        startTime: new Date(form.startTime).toISOString(),
        endTime:   form.endTime ? new Date(form.endTime).toISOString() : null,
        repeat:    form.repeat,
        priority:  form.priority,
      }),
    });
    setForm({ groupId: "", startTime: "", endTime: "", repeat: "none", priority: 0 });
    setCreating(false);
    load();
  };

  const handleToggle = async (s: Schedule) => {
    await fetch(`/api/schedules/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このスケジュールを削除しますか？")) return;
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    load();
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.groupId) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: broadcast.groupId, priority: broadcast.priority }),
      });
      if (res.ok) {
        const { sent, connectedCount: cnt } = await res.json();
        setConnectedCount(cnt);
        const name = groups.find(g => g.id === broadcast.groupId)?.name ?? broadcast.groupId;
        if (cnt === 0) {
          setBroadcastResult({ type: "none", message: "接続中のディスプレイがありません" });
        } else if (sent === 0) {
          setBroadcastResult({
            type: "blocked",
            message: `配信がブロックされました（${cnt}台が高優先度のコンテンツを再生中）。「優先度をリセット」してから再試行してください。`,
          });
        } else {
          setBroadcastResult({ type: "success", message: `「${name}」を ${sent} / ${cnt} 台に配信しました` });
        }
      } else {
        setBroadcastResult({ type: "error", message: "配信に失敗しました" });
      }
    } catch {
      setBroadcastResult({ type: "error", message: "通信エラーが発生しました" });
    }
    setBroadcasting(false);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await fetch("/api/broadcasts", { method: "DELETE" });
      setBroadcastResult({ type: "success", message: "優先度をリセットしました。通常スケジュールが再開できます。" });
    } catch {
      setBroadcastResult({ type: "error", message: "リセットに失敗しました" });
    }
    setResetting(false);
  };

  // ── Timeline calculations ────────────────────────────────────────
  const groupColorMap = new Map<string, string>();
  groups.forEach((g, i) => groupColorMap.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]));

  const slots = getSlotsForDate(schedules, timelineDate, groupColorMap);
  assignLanes(slots);

  const slotsByGroup = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const gid = slot.schedule.groupId;
    if (!slotsByGroup.has(gid)) slotsByGroup.set(gid, []);
    slotsByGroup.get(gid)!.push(slot);
  }

  const currentTimeMin = isSameDay(timelineDate, now)
    ? now.getHours() * 60 + now.getMinutes()
    : null;

  const prevDate = () => {
    const d = new Date(timelineDate);
    d.setDate(d.getDate() - 1);
    setTimelineDate(d);
  };
  const nextDate = () => {
    const d = new Date(timelineDate);
    d.setDate(d.getDate() + 1);
    setTimelineDate(d);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  const resultColors: Record<string, string> = {
    success: "text-green-700 bg-green-50 border-green-200",
    blocked: "text-orange-700 bg-orange-50 border-orange-200",
    none:    "text-gray-600 bg-gray-50 border-gray-200",
    error:   "text-red-700 bg-red-50 border-red-200",
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Header + tab switcher */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-800">スケジュール管理</h2>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            onClick={() => setView("list")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            リスト
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-l border-gray-200 ${
              view === "timeline"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            タイムライン
          </button>
        </div>
      </div>

      {/* ── 即時配信 (always shown) ─────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 mb-8">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-700">即時配信</h3>
          <span className="text-sm text-gray-500">
            接続中:{" "}
            <span className={`font-semibold ${connectedCount > 0 ? "text-green-600" : "text-gray-400"}`}>
              {connectedCount} 台
            </span>
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-1">
          スケジュールを作成せず、今すぐ全ディスプレイに配信します。
        </p>
        <p className="text-xs text-gray-400 mb-5">
          優先度が高いほど割り込み優先。高優先度で配信すると、次のスケジューラー実行（最大1分）まで低優先度のスケジュールが配信されなくなります。
        </p>
        <form onSubmit={handleBroadcast} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-semibold text-gray-600 mb-2">グループ</label>
            <select
              value={broadcast.groupId}
              onChange={e => setBroadcast({ ...broadcast, groupId: e.target.value })}
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">グループを選択</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              優先度
              <span className="ml-1 font-normal text-xs text-gray-400">（0=通常 / 10=緊急）</span>
            </label>
            <input
              type="number" min={0} max={100}
              value={broadcast.priority}
              onChange={e => setBroadcast({ ...broadcast, priority: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            type="submit"
            disabled={broadcasting || !broadcast.groupId}
            className="px-6 py-3 bg-green-600 text-white text-base font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {broadcasting ? "配信中..." : "今すぐ配信"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="px-5 py-3 bg-gray-100 text-gray-700 text-base font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors border border-gray-300"
            title="高優先度ブロードキャストによるブロックを解除します"
          >
            {resetting ? "リセット中..." : "優先度をリセット"}
          </button>
        </form>
        {broadcastResult && (
          <div className="mt-4 flex items-center gap-3">
            <p className={`text-sm font-medium border px-4 py-2 rounded-lg ${resultColors[broadcastResult.type]}`}>
              {broadcastResult.message}
            </p>
            <button
              onClick={() => setBroadcastResult(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── Timeline View ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "timeline" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Date navigation */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
            <button
              onClick={prevDate}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 border border-gray-300"
            >
              ← 前日
            </button>
            <button
              onClick={() => setTimelineDate(new Date())}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 border border-gray-300"
            >
              今日
            </button>
            <span className="text-base font-semibold text-gray-700">{formatDate(timelineDate)}</span>
            <button
              onClick={nextDate}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 border border-gray-300"
            >
              翌日 →
            </button>
          </div>

          {/* Scrollable grid */}
          <div
            ref={scrollRef}
            className="overflow-x-auto"
            style={{ cursor: dragState ? "grabbing" : undefined }}
          >
            <div style={{ width: LABEL_WIDTH + TOTAL_HOURS * HOUR_WIDTH }}>

              {/* ── Hour header ── */}
              <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: 36 }}>
                {/* sticky corner */}
                <div
                  className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 flex items-center px-3 flex-shrink-0"
                  style={{ width: LABEL_WIDTH }}
                >
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">グループ</span>
                </div>
                {/* hour cells */}
                <div
                  className="relative flex-shrink-0"
                  style={{ width: TOTAL_HOURS * HOUR_WIDTH, height: 36 }}
                >
                  {Array.from({ length: TOTAL_HOURS + 1 }, (_, h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-gray-200 flex items-center"
                      style={{ left: h * HOUR_WIDTH, width: HOUR_WIDTH }}
                    >
                      <span className="text-xs text-gray-400 pl-1 select-none">{hourLabel(h)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Group rows ── */}
              {groups.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                  グループがありません
                </div>
              ) : (
                groups.map(g => {
                  const groupSlots = slotsByGroup.get(g.id) ?? [];
                  const numLanes = groupSlots.length > 0
                    ? Math.max(...groupSlots.map(s => s.lane)) + 1
                    : 1;
                  const rowHeight = numLanes * LANE_HEIGHT + TOP_PADDING * 2;
                  const gColor = groupColorMap.get(g.id) ?? GROUP_COLORS[0];

                  return (
                    <div
                      key={g.id}
                      className="flex border-b border-gray-100 last:border-0"
                      style={{ height: rowHeight }}
                    >
                      {/* Sticky group label */}
                      <div
                        className="sticky left-0 z-10 bg-white border-r border-gray-200 flex items-center px-3 overflow-hidden flex-shrink-0"
                        style={{ width: LABEL_WIDTH }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: gColor }}
                          />
                          <span className="text-sm font-medium text-gray-700 truncate">{g.name}</span>
                        </div>
                      </div>

                      {/* Timeline area */}
                      <div
                        className="relative flex-shrink-0"
                        style={{ width: TOTAL_HOURS * HOUR_WIDTH, height: rowHeight }}
                      >
                        {/* Vertical grid lines */}
                        {Array.from({ length: TOTAL_HOURS + 1 }, (_, h) => (
                          <div
                            key={h}
                            className="absolute top-0 bottom-0 border-l border-gray-100"
                            style={{ left: h * HOUR_WIDTH }}
                          />
                        ))}

                        {/* Current time indicator */}
                        {currentTimeMin !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-px z-10 pointer-events-none"
                            style={{ left: (currentTimeMin / 60) * HOUR_WIDTH, backgroundColor: "#f87171" }}
                          />
                        )}

                        {/* Schedule bars */}
                        {groupSlots.map(slot => {
                          const isDragging = dragState?.scheduleId === slot.schedule.id;
                          const offsetMin  = isDragging ? dragState!.currentOffsetMin : 0;
                          const startMin   = slot.displayStartMin + offsetMin;
                          const endMin     = slot.displayEndMin != null ? slot.displayEndMin + offsetMin : null;

                          const left     = (startMin / 60) * HOUR_WIDTH;
                          const rawWidth = endMin != null
                            ? ((endMin - startMin) / 60) * HOUR_WIDTH
                            : MIN_BAR_WIDTH;
                          const width  = Math.max(MIN_BAR_WIDTH, rawWidth);
                          const top    = slot.lane * LANE_HEIGHT + TOP_PADDING;
                          const bColor = priorityBorderColor(slot.schedule.priority, slot.color);

                          const startLabel = formatMin(slot.displayStartMin);
                          const endLabel   = slot.displayEndMin != null ? formatMin(slot.displayEndMin) : "";
                          const barText    = endLabel ? `${startLabel}–${endLabel}` : startLabel;

                          const titleText = [
                            g.name,
                            `開始: ${startLabel}`,
                            endLabel ? `終了: ${endLabel}` : "終了: なし",
                            `優先度: ${slot.schedule.priority}`,
                            `繰り返し: ${repeatLabels[slot.schedule.repeat] ?? slot.schedule.repeat}`,
                          ].join("\n");

                          return (
                            <div
                              key={slot.schedule.id}
                              className={`absolute rounded select-none ${
                                isDragging ? "shadow-xl z-30" : "z-10"
                              }`}
                              style={{
                                left,
                                top,
                                width,
                                height: LANE_HEIGHT - 4,
                                backgroundColor: slot.color,
                                borderLeft: `3px solid ${bColor}`,
                                opacity: slot.schedule.active ? 1 : 0.4,
                                cursor: isDragging ? "grabbing" : "grab",
                                touchAction: "none",
                              }}
                              title={titleText}
                              onPointerDown={e => {
                                e.preventDefault();
                                const state: DragState = {
                                  scheduleId:        slot.schedule.id,
                                  originalStartTime: new Date(slot.schedule.startTime),
                                  originalEndTime:   slot.schedule.endTime
                                    ? new Date(slot.schedule.endTime)
                                    : null,
                                  startX:            e.clientX,
                                  currentOffsetMin:  0,
                                };
                                dragRef.current = state;
                                setDragState(state);
                              }}
                            >
                              <div className="flex items-center h-full px-1.5 overflow-hidden gap-0.5">
                                {slot.crossDayStart && (
                                  <span className="text-white text-xs flex-shrink-0 opacity-80">◀</span>
                                )}
                                <span className="text-white text-xs font-medium truncate leading-none">
                                  {width >= 80 ? barText : startLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-gray-200 bg-gray-50">
            {groups.map((g, i) => (
              <div key={g.id} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length] }}
                />
                <span className="text-sm text-gray-600">{g.name}</span>
              </div>
            ))}
            {currentTimeMin !== null && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-0.5 h-4 rounded-full" style={{ backgroundColor: "#f87171" }} />
                <span className="text-sm text-gray-500">現在時刻</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── List View ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === "list" && (
        <>
          {/* New schedule form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-5">新規スケジュール</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">グループ</label>
                <select
                  value={form.groupId}
                  onChange={e => setForm({ ...form, groupId: e.target.value })}
                  required
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">グループを選択</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">開始時刻</label>
                <input
                  type="datetime-local"
                  value={form.startTime}
                  onChange={e => setForm({ ...form, startTime: e.target.value })}
                  onClick={e => {
                    if (!form.startTime) setForm(f => ({ ...f, startTime: defaultStartTime() }));
                    (e.target as HTMLInputElement).showPicker?.();
                  }}
                  required
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  終了時刻
                  <span className="ml-2 text-xs font-normal text-gray-400">（任意 — 繰り返しの場合、この時刻以降は停止）</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.endTime}
                  onChange={e => setForm({ ...form, endTime: e.target.value })}
                  onClick={e => { (e.target as HTMLInputElement).showPicker?.(); }}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">繰り返し</label>
                <select
                  value={form.repeat}
                  onChange={e => setForm({ ...form, repeat: e.target.value })}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="none">1回のみ</option>
                  <option value="daily">毎日</option>
                  <option value="weekly">毎週</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  優先度
                  <span className="ml-2 text-xs font-normal text-gray-400">0=通常 / 5=高 / 10=緊急割り込み</span>
                </label>
                <input
                  type="number" min={0} max={100}
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "作成中..." : "スケジュール作成"}
                </button>
              </div>
            </form>
          </div>

          {/* Schedule list */}
          {schedules.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">スケジュールがありません</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">状態</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">グループ</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">次回発火</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">終了時刻</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">繰り返し</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide">優先度</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => {
                    const badge = priorityBadge(s.priority);
                    return (
                      <tr
                        key={s.id}
                        className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${!s.active ? "opacity-50" : ""}`}
                      >
                        <td className="px-5 py-4">
                          <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-semibold ${
                            s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {s.active ? "有効" : "無効"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-base font-medium text-gray-800">{s.group.name}</td>
                        <td className="px-5 py-4">
                          {s.active ? (
                            <div>
                              <div className="text-base text-gray-700">{new Date(s.startTime).toLocaleString("ja-JP")}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{relativeTime(s.startTime)}</div>
                            </div>
                          ) : (
                            <span className="text-base text-gray-700">{new Date(s.startTime).toLocaleString("ja-JP")}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-base text-gray-600">
                          {s.endTime
                            ? new Date(s.endTime).toLocaleString("ja-JP")
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-4 text-base text-gray-600">
                          {repeatLabels[s.repeat] ?? s.repeat}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleToggle(s)}
                              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
                            >
                              {s.active ? "無効化" : "有効化"}
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors border border-red-200"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
