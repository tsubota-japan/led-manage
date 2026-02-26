import cron from "node-cron";
import { prisma } from "./prisma";
import { broadcastToAll, resetAllClientPriorities } from "./sse-manager";

let initialized = false;

/** repeat ロジックを共通化 */
async function handleRepeat(
  schedule: { id: string; startTime: Date; endTime: Date | null; repeat: string },
  now: Date
) {
  if (schedule.repeat === "daily") {
    const next = new Date(schedule.startTime);
    while (next <= now) next.setDate(next.getDate() + 1);
    const pastEnd = schedule.endTime && next > schedule.endTime;
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { startTime: next, ...(pastEnd && { active: false }) },
    });
  } else if (schedule.repeat === "weekly") {
    const next = new Date(schedule.startTime);
    while (next <= now) next.setDate(next.getDate() + 7);
    const pastEnd = schedule.endTime && next > schedule.endTime;
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { startTime: next, ...(pastEnd && { active: false }) },
    });
  } else if (schedule.repeat === "always") {
    // 常時配信: deactivate せず startTime も変更しない（再起動時に再発火させるため）
  } else {
    // none - deactivate
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { active: false },
    });
  }
}

/**
 * 起動時キャッチアップ：サーバー停止中に通過したスケジュールを処理する。
 * - repeat=none: 即時発火して無効化
 * - repeat=daily/weekly: startTime を次回以降に進めた上で発火
 * 優先度の低い順に処理し、最後に高優先度のものが __sseGlobalLast に残るようにする。
 */
async function catchUpOverdueSchedules() {
  const now = new Date();
  const overdue = await prisma.schedule.findMany({
    where: {
      active: true,
      startTime: { lte: now },
    },
    orderBy: { priority: "asc" }, // 低優先度から処理 → 最後に高優先度が __sseGlobalLast に残る
  });

  if (overdue.length === 0) return;

  console.log(`[scheduler] catchup: found ${overdue.length} overdue schedule(s)`);

  for (const schedule of overdue) {
    // endTime を過ぎていれば無効化のみ
    if (schedule.endTime && now > schedule.endTime) {
      await prisma.schedule.update({ where: { id: schedule.id }, data: { active: false } });
      continue;
    }

    console.log(`[scheduler] catchup firing schedule ${schedule.id}, groupId=${schedule.groupId}, priority=${schedule.priority}`);
    broadcastToAll(schedule.groupId, schedule.priority);

    await handleRepeat(schedule, now);
  }
}

export function initScheduler() {
  if (initialized) return;
  initialized = true;

  // 起動時キャッチアップ（非同期・バックグラウンド実行）
  catchUpOverdueSchedules().catch((err) =>
    console.error("[scheduler] catchup error:", err)
  );

  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // tick 開始時に全ディスプレイの優先度をリセット。
      // これにより前 tick 以前の高優先度ブロードキャストが今回のスケジュール発火を阻害しない。
      resetAllClientPriorities();

      // 70秒ウィンドウ（cronが数秒遅延しても確実に拾えるよう余裕を持たせる）
      const windowStart = new Date(now.getTime() - 70 * 1000);

      const schedules = await prisma.schedule.findMany({
        where: {
          active: true,
          startTime: {
            gte: windowStart,
            lte: now,
          },
        },
        orderBy: { priority: "desc" },
      });

      console.log(`[scheduler] tick: ${now.toISOString()}, found ${schedules.length} schedule(s)`);

      for (const schedule of schedules) {
        // 常時配信はcronでは発火しない（起動時キャッチアップ専用）
        if (schedule.repeat === "always") continue;

        // endTime が設定されており、現在時刻を過ぎていればスキップして無効化
        if (schedule.endTime && now > schedule.endTime) {
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: { active: false },
          });
          continue;
        }

        console.log(`[scheduler] firing schedule ${schedule.id}, groupId=${schedule.groupId}, priority=${schedule.priority}`);
        broadcastToAll(schedule.groupId, schedule.priority);

        await handleRepeat(schedule, now);
      }
    } catch (err) {
      console.error("[scheduler] error:", err);
    }
  });

  console.log("[scheduler] initialized");
}
