import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export type McpSessionRecord = {
  sessionId: string;
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  authClientId: string | null;
  createdAt: number;
  lastSeenAt: number;
};

export class McpSessionStore {
  private readonly sessions = new Map<string, McpSessionRecord>();

  constructor(private readonly ttlMs: number) {}

  size(): number {
    return this.sessions.size;
  }

  get(sessionId: string): McpSessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  set(record: McpSessionRecord): void {
    this.sessions.set(record.sessionId, record);
  }

  touch(sessionId: string): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return;
    }

    existing.lastSeenAt = Date.now();
  }

  async delete(sessionId: string): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return;
    }

    this.sessions.delete(sessionId);
    await Promise.allSettled([existing.transport.close(), existing.server.close()]);
  }

  async pruneExpired(now = Date.now()): Promise<number> {
    const expiredSessionIds: string[] = [];

    for (const [sessionId, record] of this.sessions.entries()) {
      if (now - record.lastSeenAt >= this.ttlMs) {
        expiredSessionIds.push(sessionId);
      }
    }

    if (expiredSessionIds.length === 0) {
      return 0;
    }

    await Promise.all(expiredSessionIds.map((sessionId) => this.delete(sessionId)));
    return expiredSessionIds.length;
  }

  async closeAll(): Promise<void> {
    const sessionIds = [...this.sessions.keys()];
    await Promise.all(sessionIds.map((sessionId) => this.delete(sessionId)));
  }
}
