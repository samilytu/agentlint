import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

// ── Types ──────────────────────────────────────────────────────────────

export type ClientId =
  | "claude-code"
  | "codex"
  | "cursor"
  | "opencode"
  | "windsurf"
  | "claude-desktop"
  | "vscode"
  | "kilo-code"
  | "cline"
  | "roo-code"
  | "kiro"
  | "zed"
  | "antigravity";

export type ConfigFormat = "json" | "toml";
export type Scope = "global" | "workspace";

export interface ScopeConfig {
  /** Path relative to workspace root (workspace) or absolute (global) */
  pathTemplate: string;
  /** Whether the path is absolute (global) or relative to cwd (workspace) */
  absolute: boolean;
}

export interface McpClient {
  id: ClientId;
  name: string;
  configFormat: ConfigFormat;
  /** JSON key that contains the MCP servers map */
  rootKey: string;
  /** Scopes this client supports */
  scopes: Partial<Record<Scope, ScopeConfig>>;
  /** Binary names to detect (via `which`/`where`) */
  detectBinaries: string[];
  /** Directory names to detect relative to cwd */
  detectDirs: string[];
  /** Additional file or directory paths to detect relative to cwd */
  detectPaths?: string[];
  /** VS Code extension directory prefixes used for install detection */
  detectExtensionPrefixes?: string[];
  /** If the client has its own CLI for adding MCP servers */
  cliCommand?: {
    binary: string;
    buildArgs: (scope: Scope) => string[];
  };
}

// ── MCP Server Payload ─────────────────────────────────────────────────

const MCP_SERVER_NAME = "agentlint";
const MCP_COMMAND = "npx";
const MCP_ARGS: readonly string[] = Object.freeze(["-y", "@agent-lint/mcp"]);

function stdioEntry(): Record<string, unknown> {
  return { command: MCP_COMMAND, args: [...MCP_ARGS] };
}

/** Returns just the server entry (without rootKey wrapper) for merge operations */
export function buildServerEntry(client: McpClient): Record<string, unknown> {
  switch (client.id) {
    case "vscode":
      return { type: "stdio", ...stdioEntry() };

    case "zed":
      return {
        command: { path: MCP_COMMAND, args: [...MCP_ARGS] },
        settings: {},
      };

    case "opencode":
      return {
        type: "local",
        command: [MCP_COMMAND, ...MCP_ARGS],
        enabled: true,
      };

    case "codex":
      return { command: MCP_COMMAND, args: [...MCP_ARGS] };

    default:
      return stdioEntry();
  }
}

// ── Platform Helpers ───────────────────────────────────────────────────

function home(): string {
  return os.homedir();
}

function appData(): string {
  if (process.platform === "win32") {
    return process.env["APPDATA"] ?? path.join(home(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(home(), "Library", "Application Support");
  }
  // Linux / other: XDG_CONFIG_HOME or ~/.config
  return process.env["XDG_CONFIG_HOME"] ?? path.join(home(), ".config");
}

function vscodeGlobalPath(): string {
  if (process.platform === "darwin") {
    return path.join(home(), "Library", "Application Support", "Code", "User", "mcp.json");
  }
  if (process.platform === "win32") {
    const ad = process.env["APPDATA"] ?? path.join(home(), "AppData", "Roaming");
    return path.join(ad, "Code", "User", "mcp.json");
  }
  return path.join(appData(), "Code", "User", "mcp.json");
}

function vscodeUserPath(): string {
  if (process.platform === "darwin") {
    return path.join(home(), "Library", "Application Support", "Code", "User");
  }
  if (process.platform === "win32") {
    const ad = process.env["APPDATA"] ?? path.join(home(), "AppData", "Roaming");
    return path.join(ad, "Code", "User");
  }
  return path.join(appData(), "Code", "User");
}

function vscodeExtensionStoragePath(extensionId: string, filename: string = "mcp_settings.json"): string {
  return path.join(vscodeUserPath(), "globalStorage", extensionId.toLowerCase(), "settings", filename);
}

function vscodeExtensionsPath(): string {
  return path.join(home(), ".vscode", "extensions");
}

// ── Client Registry ────────────────────────────────────────────────────

export const CLIENT_REGISTRY: McpClient[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      workspace: { pathTemplate: ".mcp.json", absolute: false },
      global: { pathTemplate: path.join(home(), ".claude.json"), absolute: true },
    },
    detectBinaries: ["claude"],
    detectDirs: [".claude"],
    detectPaths: [".mcp.json"],
    cliCommand: {
      binary: "claude",
      buildArgs: (scope: Scope) => [
        "mcp",
        "add",
        "--transport",
        "stdio",
        "--scope",
        scope === "global" ? "user" : "project",
        MCP_SERVER_NAME,
        "--",
        ...(process.platform === "win32"
          ? ["cmd", "/c", MCP_COMMAND, ...MCP_ARGS]
          : [MCP_COMMAND, ...MCP_ARGS]),
      ],
    },
  },
  {
    id: "codex",
    name: "Codex",
    configFormat: "toml",
    rootKey: "mcp_servers",
    scopes: {
      workspace: { pathTemplate: ".codex/config.toml", absolute: false },
      global: { pathTemplate: path.join(home(), ".codex", "config.toml"), absolute: true },
    },
    detectBinaries: ["codex"],
    detectDirs: [".codex"],
    cliCommand: {
      binary: "codex",
      buildArgs: (_scope: Scope) => [
        "mcp", "add", MCP_SERVER_NAME, "--", MCP_COMMAND, ...MCP_ARGS,
      ],
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      workspace: { pathTemplate: ".cursor/mcp.json", absolute: false },
      global: { pathTemplate: path.join(home(), ".cursor", "mcp.json"), absolute: true },
    },
    detectBinaries: ["cursor"],
    detectDirs: [".cursor"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    configFormat: "json",
    rootKey: "mcp",
    scopes: {
      workspace: { pathTemplate: "opencode.json", absolute: false },
      global: { pathTemplate: path.join(home(), ".config", "opencode", "opencode.json"), absolute: true },
    },
    detectBinaries: ["opencode"],
    detectDirs: [],
    detectPaths: ["opencode.json", ".opencode"],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      workspace: { pathTemplate: ".windsurf/mcp_config.json", absolute: false },
      global: {
        pathTemplate: path.join(home(), ".codeium", "windsurf", "mcp_config.json"),
        absolute: true,
      },
    },
    detectBinaries: ["windsurf"],
    detectDirs: [".windsurf"],
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      global: {
        pathTemplate:
          process.platform === "win32"
            ? path.join(
                process.env["APPDATA"] ?? path.join(home(), "AppData", "Roaming"),
                "Claude",
                "claude_desktop_config.json",
              )
            : process.platform === "darwin"
              ? path.join(home(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
              : path.join(appData(), "Claude", "claude_desktop_config.json"),
        absolute: true,
      },
    },
    detectBinaries: [],
    detectDirs: [],
  },
  {
    id: "vscode",
    name: "VS Code",
    configFormat: "json",
    rootKey: "servers",
    scopes: {
      workspace: { pathTemplate: ".vscode/mcp.json", absolute: false },
      global: { pathTemplate: vscodeGlobalPath(), absolute: true },
    },
    detectBinaries: ["code"],
    detectDirs: [".vscode"],
  },
  {
    id: "kilo-code",
    name: "Kilo Code",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      workspace: { pathTemplate: ".kilocode/mcp.json", absolute: false },
      global: {
        pathTemplate: vscodeExtensionStoragePath("kilocode.kilo-code"),
        absolute: true,
      },
    },
    detectBinaries: [],
    detectDirs: [".kilocode"],
    detectPaths: [".kilocode/mcp.json"],
    detectExtensionPrefixes: ["kilocode.kilo-code-"],
  },
  {
    id: "cline",
    name: "Cline",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      global: {
        pathTemplate:
          process.platform === "win32"
            ? vscodeExtensionStoragePath("saoudrizwan.claude-dev", "cline_mcp_settings.json")
            : path.join(home(), ".cline", "data", "settings", "cline_mcp_settings.json"),
        absolute: true,
      },
    },
    detectBinaries: [],
    detectDirs: [],
    detectExtensionPrefixes: ["saoudrizwan.claude-dev-"],
  },
  {
    id: "roo-code",
    name: "Roo Code",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      workspace: { pathTemplate: ".roo/mcp.json", absolute: false },
      global: { pathTemplate: vscodeExtensionStoragePath("rooveterinaryinc.roo-cline"), absolute: true },
    },
    detectBinaries: [],
    detectDirs: [".roo"],
    detectPaths: [".roo/mcp.json"],
    detectExtensionPrefixes: ["rooveterinaryinc.roo-cline-"],
  },
  {
    id: "kiro",
    name: "Kiro",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      workspace: { pathTemplate: ".kiro/settings/mcp.json", absolute: false },
      global: {
        pathTemplate: path.join(home(), ".kiro", "settings", "mcp.json"),
        absolute: true,
      },
    },
    detectBinaries: ["kiro"],
    detectDirs: [".kiro"],
    detectPaths: [".kiro/settings/mcp.json"],
  },
  {
    id: "zed",
    name: "Zed",
    configFormat: "json",
    rootKey: "context_servers",
    scopes: {
      workspace: { pathTemplate: ".zed/settings.json", absolute: false },
      global: {
        pathTemplate:
          process.platform === "darwin"
            ? path.join(home(), ".config", "zed", "settings.json")
            : process.platform === "win32"
              ? path.join(
                  process.env["LOCALAPPDATA"] ?? path.join(home(), "AppData", "Local"),
                  "zed",
                  "settings.json",
                )
              : path.join(appData(), "zed", "settings.json"),
        absolute: true,
      },
    },
    detectBinaries: ["zed"],
    detectDirs: [".zed"],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    configFormat: "json",
    rootKey: "mcpServers",
    scopes: {
      global: {
        pathTemplate: path.join(home(), ".gemini", "antigravity", "mcp_config.json"),
        absolute: true,
      },
    },
    detectBinaries: [],
    detectDirs: [".gemini"],
    detectPaths: [],
  },
];

// ── Detection ──────────────────────────────────────────────────────────

function whichSync(binary: string): boolean {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    execFileSync(cmd, [binary], { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export interface DetectedClient {
  client: McpClient;
  /** How it was detected */
  detectedBy: "binary" | "directory" | "extension" | "config-exists";
}

function getWorkspaceDetectionPaths(client: McpClient, cwd: string): string[] {
  return [
    ...client.detectDirs.map((dir) => path.join(cwd, dir)),
    ...(client.detectPaths ?? []).map((entry) => path.join(cwd, entry)),
  ];
}

function hasExtensionInstall(prefixes: readonly string[] | undefined): boolean {
  if (!prefixes || prefixes.length === 0) {
    return false;
  }

  const extensionsDir = vscodeExtensionsPath();
  if (!fs.existsSync(extensionsDir)) {
    return false;
  }

  try {
    const entries = fs.readdirSync(extensionsDir, { withFileTypes: true });
    return entries.some((entry) =>
      entry.isDirectory() && prefixes.some((prefix) => entry.name.toLowerCase().startsWith(prefix.toLowerCase())));
  } catch {
    return false;
  }
}

/**
 * Detect which MCP-capable IDE clients are installed.
 * Checks: binary on PATH, workspace directories, global config existence.
 */
export function detectInstalledClients(cwd: string): DetectedClient[] {
  const results: DetectedClient[] = [];
  const seen = new Set<ClientId>();

  for (const client of CLIENT_REGISTRY) {
    if (seen.has(client.id)) continue;

    // Check binaries on PATH
    for (const bin of client.detectBinaries) {
      if (whichSync(bin)) {
        seen.add(client.id);
        results.push({ client, detectedBy: "binary" });
        break;
      }
    }
    if (seen.has(client.id)) continue;

    // Check VS Code extension installation directories
    if (hasExtensionInstall(client.detectExtensionPrefixes)) {
      seen.add(client.id);
      results.push({ client, detectedBy: "extension" });
    }
    if (seen.has(client.id)) continue;

    // Check workspace paths
    for (const workspacePath of getWorkspaceDetectionPaths(client, cwd)) {
      if (fs.existsSync(workspacePath)) {
        seen.add(client.id);
        results.push({ client, detectedBy: "directory" });
        break;
      }
    }
    if (seen.has(client.id)) continue;

    // Check if global config file already exists
    const globalScope = client.scopes.global;
    if (globalScope && fs.existsSync(globalScope.pathTemplate)) {
      seen.add(client.id);
      results.push({ client, detectedBy: "config-exists" });
    }
  }

  return results;
}

export function getDefaultSelectedClientIds(detected: DetectedClient[], cwd: string): ClientId[] {
  if (detected.length === 1) {
    return [detected[0].client.id];
  }

  return detected
    .filter((entry) => {
      if (entry.detectedBy === "config-exists") {
        return true;
      }

      if (entry.detectedBy === "extension") {
        return true;
      }

      return getWorkspaceDetectionPaths(entry.client, cwd).some((workspacePath) => fs.existsSync(workspacePath));
    })
    .map((entry) => entry.client.id);
}

// ── Path Resolution ────────────────────────────────────────────────────

/**
 * Resolve the absolute config file path for a client + scope combination.
 */
export function resolveConfigPath(client: McpClient, scope: Scope, cwd: string): string | null {
  const scopeConfig = client.scopes[scope];
  if (!scopeConfig) return null;

  if (scopeConfig.absolute) {
    return scopeConfig.pathTemplate;
  }
  return path.join(cwd, scopeConfig.pathTemplate);
}

/**
 * Get available scopes for a client.
 */
export function getAvailableScopes(client: McpClient): Scope[] {
  const scopes: Scope[] = [];
  if (client.scopes.workspace) scopes.push("workspace");
  if (client.scopes.global) scopes.push("global");
  return scopes;
}

export { MCP_SERVER_NAME };
