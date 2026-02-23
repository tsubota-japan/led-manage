import cron from "node-cron";
import { prisma } from "./prisma";
import { broadcastToAll } from "./sse-manager";

let initialized = false;

export function initScheduler() {
  if (initialized) return;
  initialized = true;

  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Find schedules that should fire: startTime is within the last minute and active
      const schedules = await prisma.schedule.findMany({
        where: {
          active: true,
          startTime: {
            gte: oneMinuteAgo,
            lte: now,
          },
        },
        orderBy: { priority: "desc" },
      });

      for (const schedule of schedules) {
        // Broadcast to all displays
        broadcastToAll(schedule.groupId, schedule.priority);

        // Handle repeat logic
        if (schedule.repeat === "daily") {
          const next = new Date(schedule.startTime);
          next.setDate(next.getDate() + 1);
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: { startTime: next },
          });
        } else if (schedule.repeat === "weekly") {
          const next = new Date(schedule.startTime);
          next.setDate(next.getDate() + 7);
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: { startTime: next },
          });
        } else {
          // none - deactivate
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: { active: false },
          });
        }
      }
    } catch (err) {
      console.error("[scheduler] error:", err);
    }
  });

  console.log("[scheduler] initialized");
}
