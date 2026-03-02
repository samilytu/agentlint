import React, { useState, useEffect } from "react";
import fs from "node:fs";
import path from "node:path";
import { Box, Text, render } from "ink";
import { Spinner } from "@inkjs/ui";
import {
  Banner,
  SectionTitle,
  SuccessItem,
  SkipItem,
  InfoItem,
  ErrorItem,
  NextStep,
  Divider,
} from "../ui/components.js";
import { colors } from "../ui/theme.js";

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
    if (client.detectDir === null) continue;
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

type InitResult = {
  created: string[];
  skipped: string[];
  notes: { client: string; note: string }[];
  noClients: boolean;
};

function runInit(options: { yes?: boolean; all?: boolean }): InitResult {
  const rootPath = process.cwd();
  const detected = options.all ? CLIENT_CONFIGS : detectClients(rootPath);
  const created: string[] = [];
  const skipped: string[] = [];
  const notes: { client: string; note: string }[] = [];

  if (detected.length === 0 && !options.all) {
    return { created, skipped, notes, noClients: true };
  }

  for (const client of detected) {
    if (!client.configPath) {
      if (client.note) {
        notes.push({ client: client.name, note: client.note });
      }
      continue;
    }

    const fullPath = path.join(rootPath, client.configPath);

    if (fs.existsSync(fullPath) && !options.yes) {
      skipped.push(`${client.configPath} (${client.name}) — already exists`);
      continue;
    }

    const config = client.buildConfig();
    if (!config) {
      if (client.note) {
        notes.push({ client: client.name, note: client.note });
      }
      continue;
    }

    ensureDir(fullPath);
    fs.writeFileSync(fullPath, config, "utf-8");
    created.push(`${client.configPath} (${client.name})`);

    if (client.note) {
      notes.push({ client: client.name, note: client.note });
    }
  }

  return { created, skipped, notes, noClients: false };
}

function InitApp({ options }: { options: { yes?: boolean; all?: boolean } }): React.ReactNode {
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const [result, setResult] = useState<InitResult | null>(null);

  useEffect(() => {
    const id = setImmediate(() => {
      const r = runInit(options);
      setResult(r);
      setPhase("done");
    });
    return () => clearImmediate(id);
  }, []);

  return (
    <Box flexDirection="column">
      <Banner />
      <Divider />

      {phase === "scanning" && (
        <Box marginTop={1} marginLeft={2}>
          <Spinner label="Detecting IDE clients..." />
        </Box>
      )}

      {phase === "done" && result && (
        <>
          {result.noClients ? (
            <>
              <SectionTitle>No IDE clients detected</SectionTitle>
              <Box marginLeft={2} marginTop={0}>
                <Text color={colors.muted}>
                  No .cursor/, .windsurf/, .vscode/, or .claude/ directories found.
                </Text>
              </Box>
              <NextStep>Use --all to generate configs for all supported clients.</NextStep>
            </>
          ) : (
            <>
              {result.created.length > 0 && (
                <>
                  <SectionTitle>Created</SectionTitle>
                  {result.created.map((item, i) => (
                    <SuccessItem key={i}>{item}</SuccessItem>
                  ))}
                </>
              )}

              {result.skipped.length > 0 && (
                <>
                  <SectionTitle>Skipped</SectionTitle>
                  {result.skipped.map((item, i) => (
                    <SkipItem key={i}>{item}</SkipItem>
                  ))}
                </>
              )}

              {result.notes.length > 0 && (
                <>
                  <SectionTitle>Manual steps</SectionTitle>
                  {result.notes.map((n, i) => (
                    <InfoItem key={i}>{`${n.client}: ${n.note}`}</InfoItem>
                  ))}
                </>
              )}

              {result.created.length === 0 && result.skipped.length > 0 && (
                <Box marginLeft={2} marginTop={1}>
                  <Text color={colors.muted}>No new config files created.</Text>
                </Box>
              )}

              <NextStep>
                {`Run ${"`"}agent-lint doctor${"`"} to scan your workspace.`}
              </NextStep>
            </>
          )}
        </>
      )}
    </Box>
  );
}

export function runInitCommand(options: { yes?: boolean; all?: boolean; stdout?: boolean }): void {
  if (options.stdout) {
    const result = runInit(options);
    if (result.noClients) {
      process.stdout.write("No IDE client directories detected.\n");
      return;
    }
    for (const item of result.created) {
      process.stdout.write(`[created] ${item}\n`);
    }
    for (const item of result.skipped) {
      process.stdout.write(`[skip] ${item}\n`);
    }
    for (const n of result.notes) {
      process.stdout.write(`[note] ${n.client}: ${n.note}\n`);
    }
    return;
  }

  render(<InitApp options={options} />);
}
