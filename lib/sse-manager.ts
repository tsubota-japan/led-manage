export interface SSEClient {
  controller: ReadableStreamDefaultController<Uint8Array>;
  currentGroupId: string | null;
  currentPriority: number;
}

// globalThis を使ってモジュールインスタンスをまたいで状態を共有する
// Next.js Turbopack ではルートハンドラーごとに別インスタンスになる場合があるため
const g = globalThis as typeof globalThis & {
  __sseClients?: Map<string, SSEClient>;
  __sseLastBroadcast?: Map<string, { groupId: string; priority: number }>;
  __sseGlobalLast?: { groupId: string; priority: number } | null;
};
if (!g.__sseClients) g.__sseClients = new Map();
if (!g.__sseLastBroadcast) g.__sseLastBroadcast = new Map();
if (!("__sseGlobalLast" in g)) g.__sseGlobalLast = null;

const clients = g.__sseClients;
const lastBroadcast = g.__sseLastBroadcast;
const encoder = new TextEncoder();

export function registerClient(
  code: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  clients.set(code, {
    controller,
    currentGroupId: null,
    currentPriority: -1,
  });

  // 再接続時: コード個別 or グローバルの最終グループを即座に再送する
  const last = lastBroadcast.get(code) ?? g.__sseGlobalLast;
  if (last) {
    const data = JSON.stringify({ groupId: last.groupId, priority: last.priority });
    try {
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      const client = clients.get(code);
      if (client) {
        client.currentGroupId = last.groupId;
        client.currentPriority = last.priority;
      }
    } catch {
      // 送信失敗は無視
    }
  }
}

export function unregisterClient(code: string) {
  clients.delete(code);
}

export function pushToDisplay(code: string, groupId: string, priority: number): boolean {
  const client = clients.get(code);
  let sent = false;
  if (client && priority >= client.currentPriority) {
    const data = JSON.stringify({ groupId, priority });
    try {
      client.controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      client.currentGroupId = groupId;
      client.currentPriority = priority;
      sent = true;
    } catch {
      // 送信失敗時はクライアントを削除
      clients.delete(code);
    }
  }
  // 接続有無・優先度チェック結果に関わらず lastBroadcast を更新（再接続時のために記憶）
  lastBroadcast.set(code, { groupId, priority });
  return sent;
}

export function broadcastToAll(groupId: string, priority: number): number {
  // グローバル最終状態を記憶（切断中のディスプレイが再接続したときに使う）
  g.__sseGlobalLast = { groupId, priority };

  // 現在接続中の全ディスプレイへ送信し、実際に送れた数を返す
  let sent = 0;
  for (const [code] of clients) {
    if (pushToDisplay(code, groupId, priority)) sent++;
  }
  return sent;
}

export function isConnected(code: string): boolean {
  return clients.has(code);
}

export function getConnectedCount(): number {
  return clients.size;
}

/**
 * 全ディスプレイの優先度を -1 にリセットする。
 * スケジューラーが毎tick開始時に呼ぶことで、前tick以前の高優先度ブロードキャストが
 * 次のスケジュール発火を阻害しないようにする。
 * 手動リセットAPI からも呼べる。
 */
export function resetAllClientPriorities() {
  for (const [, client] of clients) {
    client.currentPriority = -1;
  }
  // 再接続時の復元優先度もリセット（再接続後も新しいスケジュールに上書きされるよう）
  if (g.__sseGlobalLast) {
    g.__sseGlobalLast = { ...g.__sseGlobalLast, priority: -1 };
  }
  for (const [code, last] of lastBroadcast) {
    lastBroadcast.set(code, { ...last, priority: -1 });
  }
}
