import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { afterEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = Record<string, string | undefined>;

function setTempHomeEnv(tmpRoot: string): EnvSnapshot {
  const previous = {
    HOME: process.env["HOME"],
    USERPROFILE: process.env["USERPROFILE"],
    APPDATA: process.env["APPDATA"],
    XDG_CONFIG_HOME: process.env["XDG_CONFIG_HOME"],
  };

  process.env["HOME"] = path.join(tmpRoot, "home");
  process.env["USERPROFILE"] = path.join(tmpRoot, "home");
  process.env["APPDATA"] = path.join(tmpRoot, "appdata");
  process.env["XDG_CONFIG_HOME"] = path.join(tmpRoot, "xdg");

  fs.mkdirSync(process.env["HOME"], { recursive: true });
  fs.mkdirSync(process.env["APPDATA"], { recursive: true });
  fs.mkdirSync(process.env["XDG_CONFIG_HOME"], { recursive: true });

  return previous;
}

function restoreEnv(previous: EnvSnapshot): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadCliModules() {
  vi.resetModules();
  const clients = await import("../src/commands/clients.js");
  const writer = await import("../src/commands/config-writer.js");
  return { ...clients, ...writer };
}

afterEach(() => {
  vi.resetModules();
});

describe("installClient simulation", () => {
  it("writes valid MCP config for every supported client scope", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-cli-sim-"));
    const previousEnv = setTempHomeEnv(tmpRoot);
    const workspace = path.join(tmpRoot, "workspace");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      const {
        CLIENT_REGISTRY,
        getAvailableScopes,
        installClient,
      } = await loadCliModules();

      for (const client of CLIENT_REGISTRY) {
        for (const scope of getAvailableScopes(client)) {
          const result = installClient(client, scope, workspace, false);

          expect(result.status).toMatch(/^(created|merged|exists)$/);
          expect("configPath" in result).toBe(true);

          if (!("configPath" in result)) {
            continue;
          }

          const raw = fs.readFileSync(result.configPath, "utf-8");
          const parsed = client.configFormat === "toml"
            ? parseToml(raw) as Record<string, unknown>
            : JSON.parse(raw) as Record<string, unknown>;
          const rootValue = parsed[client.rootKey] as Record<string, unknown> | undefined;

          expect(rootValue).toBeDefined();
          expect(rootValue).toHaveProperty("agentlint");
        }
      }
    } finally {
      restoreEnv(previousEnv);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
