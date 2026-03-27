import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
  type McpClient,
  type Scope,
  resolveConfigPath,
  buildServerEntry,
  MCP_SERVER_NAME,
} from "./clients.js";

// ── Types ──────────────────────────────────────────────────────────────

export type InstallResult =
  | { status: "created"; configPath: string }
  | { status: "updated"; configPath: string }
  | { status: "exists"; configPath: string }
  | { status: "merged"; configPath: string }
  | { status: "cli-success"; message: string }
  | { status: "error"; message: string }
  | { status: "no-scope"; message: string };

// ── Helpers ────────────────────────────────────────────────────────────

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createBackup(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }
}

function hasMatchingEntry(existing: unknown, expected: Record<string, unknown>): boolean {
  return isDeepStrictEqual(existing, expected);
}

// ── JSON Config Merge ──────────────────────────────────────────────────

function mergeJsonConfig(
  filePath: string,
  rootKey: string,
  serverName: string,
  serverEntry: Record<string, unknown>,
): InstallResult {
  try {
    ensureDir(filePath);

    if (!fs.existsSync(filePath)) {
      // New file — create with full structure
      const config: Record<string, unknown> = { [rootKey]: { [serverName]: serverEntry } };
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      return { status: "created", configPath: filePath };
    }

    // Existing file — read, check idempotency, merge
    const raw = fs.readFileSync(filePath, "utf-8");
    let config: Record<string, unknown>;
    try {
      config = raw.trim().length === 0
        ? {}
        : JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { status: "error", message: `Failed to parse JSON: ${filePath}` };
    }

    // Validate rootKey value is an object (could be string/array/null in malformed files)
    const rootVal = config[rootKey];
    if (rootVal !== undefined && rootVal !== null && (typeof rootVal !== "object" || Array.isArray(rootVal))) {
      return { status: "error", message: `Expected object at "${rootKey}" in ${filePath}, got ${typeof rootVal}` };
    }
    const servers = (rootVal as Record<string, unknown> | undefined) ?? {};

    // Idempotency: skip if already configured
    if (serverName in servers) {
      if (hasMatchingEntry(servers[serverName], serverEntry)) {
        return { status: "exists", configPath: filePath };
      }

      createBackup(filePath);
      servers[serverName] = serverEntry;
      config[rootKey] = servers;
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      return { status: "updated", configPath: filePath };
    }

    // Merge
    createBackup(filePath);
    servers[serverName] = serverEntry;
    config[rootKey] = servers;
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    return { status: "merged", configPath: filePath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `JSON merge failed for ${filePath}: ${msg}` };
  }
}

// ── TOML Config Merge (Codex) ──────────────────────────────────────────

function mergeTomlConfig(
  filePath: string,
  rootKey: string,
  serverName: string,
  serverEntry: Record<string, unknown>,
): InstallResult {
  try {
    ensureDir(filePath);

    if (!fs.existsSync(filePath)) {
      // New file — create with TOML structure
      const config = { [rootKey]: { [serverName]: serverEntry } };
      fs.writeFileSync(filePath, stringifyToml(config) + "\n", "utf-8");
      return { status: "created", configPath: filePath };
    }

    // Existing file — read, check idempotency, merge
    const raw = fs.readFileSync(filePath, "utf-8");
    let config: Record<string, unknown>;
    try {
      config = raw.trim().length === 0
        ? {}
        : parseToml(raw) as Record<string, unknown>;
    } catch {
      return { status: "error", message: `Failed to parse TOML: ${filePath}` };
    }

    // Validate rootKey value is an object
    const rootVal = config[rootKey];
    if (rootVal !== undefined && rootVal !== null && (typeof rootVal !== "object" || Array.isArray(rootVal))) {
      return { status: "error", message: `Expected object at "${rootKey}" in ${filePath}, got ${typeof rootVal}` };
    }
    const servers = (rootVal as Record<string, unknown> | undefined) ?? {};

    // Idempotency
    if (serverName in servers) {
      if (hasMatchingEntry(servers[serverName], serverEntry)) {
        return { status: "exists", configPath: filePath };
      }

      createBackup(filePath);
      servers[serverName] = serverEntry;
      config[rootKey] = servers;
      fs.writeFileSync(filePath, stringifyToml(config) + "\n", "utf-8");
      return { status: "updated", configPath: filePath };
    }

    // Merge
    createBackup(filePath);
    servers[serverName] = serverEntry;
    config[rootKey] = servers;
    fs.writeFileSync(filePath, stringifyToml(config) + "\n", "utf-8");
    return { status: "merged", configPath: filePath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `TOML merge failed for ${filePath}: ${msg}` };
  }
}

// ── CLI-based Install ──────────────────────────────────────────────────

function installViaCli(client: McpClient, scope: Scope): InstallResult {
  if (!client.cliCommand) {
    return { status: "error", message: `No CLI command defined for ${client.name}` };
  }

  try {
    const args = client.cliCommand.buildArgs(scope);
    execFileSync(client.cliCommand.binary, args, {
      stdio: "pipe",
      timeout: 15_000,
      encoding: "utf-8",
    });
    return {
      status: "cli-success",
      message: `${client.cliCommand.binary} ${args.join(" ")}`,
    };
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; stdout?: string; message?: string };
    const detail = execErr.stderr?.trim() || execErr.stdout?.trim() || execErr.message || String(err);
    return { status: "error", message: `CLI install failed for ${client.name}: ${detail}` };
  }
}

// ── Orchestrator ───────────────────────────────────────────────────────

/**
 * Install MCP config for a client at a given scope.
 * Prefers CLI command when available, falls back to file merge.
 */
export function installClient(
  client: McpClient,
  scope: Scope,
  cwd: string,
  preferCli: boolean = false,
): InstallResult {
  // Validate scope is available
  if (!client.scopes[scope]) {
    return {
      status: "no-scope",
      message: `${client.name} does not support ${scope} scope`,
    };
  }

  // Try CLI first if available and preferred
  // Skip CLI for clients whose CLI doesn't support scope (e.g., Codex)
  const cliSupportsScope = client.id !== "codex" || scope === "global";
  if (preferCli && client.cliCommand && cliSupportsScope) {
    const cliResult = installViaCli(client, scope);
    if (cliResult.status === "cli-success") {
      return cliResult;
    }
    // CLI failed — fall through to file merge
  }

  // File-based merge
  const configPath = resolveConfigPath(client, scope, cwd);
  if (!configPath) {
    return { status: "error", message: `Cannot resolve config path for ${client.name} (${scope})` };
  }

  const serverEntry = buildServerEntry(client);

  if (client.configFormat === "toml") {
    return mergeTomlConfig(configPath, client.rootKey, MCP_SERVER_NAME, serverEntry);
  }

  return mergeJsonConfig(configPath, client.rootKey, MCP_SERVER_NAME, serverEntry);
}
