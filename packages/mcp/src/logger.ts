type McpLogLevel = "info" | "warn" | "error";

export function logMcp(level: McpLogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  console.error(JSON.stringify(payload));
}
