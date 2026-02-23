export interface SSEClient {
  controller: ReadableStreamDefaultController;
  currentGroupId: string | null;
  currentPriority: number;
}

const clients = new Map<string, SSEClient>();

export function registerClient(code: string, controller: ReadableStreamDefaultController) {
  clients.set(code, {
    controller,
    currentGroupId: null,
    currentPriority: -1,
  });
}

export function unregisterClient(code: string) {
  clients.delete(code);
}

export function pushToDisplay(code: string, groupId: string, priority: number) {
  const client = clients.get(code);
  if (!client) return false;

  if (priority >= client.currentPriority) {
    const data = JSON.stringify({ groupId, priority });
    client.controller.enqueue(`data: ${data}\n\n`);
    client.currentGroupId = groupId;
    client.currentPriority = priority;
    return true;
  }
  return false;
}

export function broadcastToAll(groupId: string, priority: number) {
  for (const [code] of clients) {
    pushToDisplay(code, groupId, priority);
  }
}

export function isConnected(code: string): boolean {
  return clients.has(code);
}

export function resetDisplayPriority(code: string) {
  const client = clients.get(code);
  if (client) {
    client.currentPriority = -1;
  }
}
