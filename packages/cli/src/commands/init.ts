import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { writeStderr, writeStdout } from "../utils.js";

type ClientConfig = {
  name: string;
  detectDir: string | null;
  configPath: string;
  buildConfig: () => string;
  note?: string;
};

function mcpStdioEntry(): Record<string, unknown> {
  return {
    command: "npx",
    args: ["-y", "@agent-lint/mcp"],
  };
}

const CLIENT_CONFIGS: ClientConfig[] = [
  {
    name: "Cursor",
    detectDir: ".cursor",
    configPath: ".cursor/mcp.json",
    buildConfig: () =>
      JSON.stringify(
        { mcpServers: { agentlint: mcpStdioEntry() } },
        null,
        2,
      ),
  },
  {
    name: "Windsurf",
    detectDir: ".windsurf",
    configPath: ".windsurf/mcp_config.json",
    buildConfig: () =>
      JSON.stringify(
        { mcpServers: { agentlint: mcpStdioEntry() } },
        null,
        2,
      ),
  },
  {
    name: "VS Code",
    detectDir: ".vscode",
    configPath: ".vscode/mcp.json",
    buildConfig: () =>
      JSON.stringify(
        {
          servers: {
            agentlint: {
              type: "stdio",
              command: "npx",
              args: ["-y", "@agent-lint/mcp"],
            },
          },
        },
        null,
        2,
      ),
  },
  {
    name: "Claude Desktop",
    detectDir: null,
    configPath: "claude_desktop_config.json",
    buildConfig: () =>
      JSON.stringify(
        { mcpServers: { agentlint: mcpStdioEntry() } },
        null,
        2,
      ),
    note:
      "Copy this file to your Claude Desktop config directory:\n" +
      "  macOS: ~/Library/Application Support/Claude/\n" +
      "  Windows: %APPDATA%\\Claude\\",
  },
  {
    name: "Claude Code CLI",
    detectDir: ".claude",
    configPath: "",
    buildConfig: () => "",
    note: "Run: claude mcp add agentlint -- npx -y @agent-lint/mcp",
  },
];

function detectClients(rootPath: string): ClientConfig[] {
  const detected: ClientConfig[] = [];

  for (const client of CLIENT_CONFIGS) {
    if (client.detectDir === null) {
      continue;
    }
    const dirPath = path.join(rootPath, client.detectDir);
    if (fs.existsSync(dirPath)) {
      detected.push(client);
    }
  }

  return detected;
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Set up Agent Lint MCP config for detected IDE clients")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--all", "Generate configs for all supported clients, not just detected ones")
    .action(async (options: { yes?: boolean; all?: boolean }) => {
      const rootPath = process.cwd();

      writeStderr("Agent Lint init — detecting IDE clients...\n");

      const detected = options.all ? CLIENT_CONFIGS : detectClients(rootPath);
      const created: string[] = [];
      const notes: string[] = [];

      if (detected.length === 0 && !options.all) {
        writeStderr(
          "No IDE client directories detected (.cursor/, .windsurf/, .vscode/, .claude/).\n" +
            "Use --all to generate configs for all supported clients.\n",
        );
        return;
      }

      for (const client of detected) {
        if (!client.configPath) {
          if (client.note) {
            notes.push(`${client.name}: ${client.note}`);
          }
          continue;
        }

        const fullPath = path.join(rootPath, client.configPath);

        if (fs.existsSync(fullPath) && !options.yes) {
          writeStderr(`  [skip] ${client.configPath} already exists.\n`);
          continue;
        }

        const config = client.buildConfig();
        if (!config) {
          if (client.note) {
            notes.push(`${client.name}: ${client.note}`);
          }
          continue;
        }

        ensureDir(fullPath);
        fs.writeFileSync(fullPath, config, "utf-8");
        created.push(client.configPath);
        writeStderr(`  [created] ${client.configPath} (${client.name})\n`);

        if (client.note) {
          notes.push(`${client.name}: ${client.note}`);
        }
      }

      writeStderr("\n");

      if (created.length > 0) {
        writeStdout(`Created ${created.length} MCP config file(s):\n`);
        for (const p of created) {
          writeStdout(`  - ${p}\n`);
        }
      } else {
        writeStdout("No new config files created.\n");
      }

      if (notes.length > 0) {
        writeStdout("\nManual steps:\n");
        for (const note of notes) {
          writeStdout(`  ${note}\n`);
        }
      }

      writeStdout(
        "\nNext: Run `agent-lint doctor` to scan your workspace and generate a fix report.\n",
      );
    });
}
