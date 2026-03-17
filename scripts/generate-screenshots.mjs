#!/usr/bin/env node

/**
 * Generate polished CLI screenshots for the README.
 *
 * Usage: node scripts/generate-screenshots.mjs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const cliPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "packages", "cli", "package.json"), "utf-8"),
);
const themeSource = fs.readFileSync(
  path.join(rootDir, "packages", "cli", "src", "ui", "theme.ts"),
  "utf-8",
);

function extractStringConstant(source, name) {
  const match = source.match(new RegExp(`export const ${name} = "([^"]+)";`));
  if (!match) {
    throw new Error(`Could not extract string constant: ${name}`);
  }
  return match[1];
}

function extractArrayConstant(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[(.*?)\\];`, "s"));
  if (!match) {
    throw new Error(`Could not extract array constant: ${name}`);
  }
  return Function(`"use strict"; return [${match[1]}];`)();
}

const BANNER_LINES = extractArrayConstant(themeSource, "BANNER_LINES");
const BANNER_LINES_2 = extractArrayConstant(themeSource, "BANNER_LINES_2");
const TAGLINE = extractStringConstant(themeSource, "TAGLINE");
const VERSION = cliPackageJson.version;

const CLI_DESCRIPTION =
  "Set up Agent Lint MCP config, scan for stale context files, and print prompts for your coding agent";
const INIT_DESCRIPTION = "Set up Agent Lint MCP config for supported IDE clients";
const DOCTOR_DESCRIPTION = "Scan the workspace and generate a context maintenance report";
const PROMPT_DESCRIPTION = "Print a ready-to-paste IDE prompt for the next maintenance step";
const PROMPT_WITH_REPORT =
  "Read the file .agentlint-report.md in this project and execute the recommended context maintenance fixes. " +
  "Use the agentlint MCP tools (agentlint_get_guidelines, agentlint_plan_workspace_autofix) " +
  "for artifact-specific guidance before editing. Apply the changes directly.";

const colors = {
  primary: "#84B179",
  secondary: "#A2CB8B",
  tertiary: "#C7EABB",
  accent: "#E8F5BD",
  dim: "#555555",
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  muted: "#777777",
};

const gradient = [
  "#84B179",
  "#93BE82",
  "#A2CB8B",
  "#B5DAA3",
  "#C7EABB",
  "#D8EFBC",
  "#E8F5BD",
];

function hexToAnsi(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const ITALIC = "\x1b[3m";

function fg(hex) {
  return hexToAnsi(hex);
}

function bold(hex, text) {
  return `${BOLD}${fg(hex)}${text}${RESET}`;
}

function italic(hex, text) {
  return `${ITALIC}${fg(hex)}${text}${RESET}`;
}

function colored(hex, text) {
  return `${fg(hex)}${text}${RESET}`;
}

function interpolateColor(start, end, ratio) {
  const r1 = parseInt(start.slice(1, 3), 16);
  const g1 = parseInt(start.slice(3, 5), 16);
  const b1 = parseInt(start.slice(5, 7), 16);
  const r2 = parseInt(end.slice(1, 3), 16);
  const g2 = parseInt(end.slice(3, 5), 16);
  const b2 = parseInt(end.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getGradientColor(position, total, stops) {
  if (total <= 1) {
    return stops[0];
  }

  const progress = position / (total - 1);
  const segment = progress * (stops.length - 1);
  const index = Math.min(Math.floor(segment), stops.length - 2);
  const localProgress = segment - index;

  return interpolateColor(stops[index], stops[index + 1], localProgress);
}

function renderGradientText(text) {
  const chars = [...text];
  const segments = [];

  for (let i = 0; i < chars.length; i += 1) {
    const color = getGradientColor(i, chars.length, gradient);
    const previous = segments[segments.length - 1];

    if (previous && previous.color === color) {
      previous.text += chars[i];
    } else {
      segments.push({ color, text: chars[i] });
    }
  }

  return segments.map((segment) => bold(segment.color, segment.text)).join("");
}

function renderBanner() {
  const lines = [];
  for (let i = 0; i < BANNER_LINES.length; i += 1) {
    const fullLine = `${BANNER_LINES[i]} ${BANNER_LINES_2[i] ?? ""}`;
    lines.push(renderGradientText(fullLine));
  }
  lines.push(
    " " + bold(colors.accent, "*") + " " + italic(colors.tertiary, TAGLINE) + " " + colored(colors.dim, `v${VERSION}`),
  );
  return lines.join("\n");
}

function renderDivider() {
  return colored(colors.dim, "───") + colored(colors.accent, " * ") + colored(colors.dim, "─".repeat(44));
}

function renderSectionTitle(title) {
  return "\n" + bold(colors.primary, "//") + " " + bold(colors.secondary, title.toUpperCase());
}

function renderSuccessItem(text) {
  return "   " + bold(colors.success, "+ ") + text;
}

function renderSkipItem(text) {
  return "   " + colored(colors.warning, "~ ") + colored(colors.muted, text);
}

function renderInfoItem(text) {
  return "   " + bold(colors.accent, "* ") + text;
}

function renderNextStep(text) {
  return "\n " + bold(colors.accent, ">> ") + colored(colors.tertiary, text);
}

function renderStatusBar(items) {
  const inner = items
    .map((item) => colored(colors.muted, item.label) + " " + bold(item.color, String(item.value)))
    .join("   ");
  const width = Math.max(inner.length + 4, 28);
  return (
    " ┌" + "─".repeat(width) + "┐\n" +
    " │  " + inner + "  │\n" +
    " └" + "─".repeat(width) + "┘"
  );
}

function renderPromptBox(text) {
  const maxWidth = 72;
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) {
    lines.push(current);
  }

  const width = Math.max(...lines.map((line) => line.length)) + 4;
  const top = colored(colors.secondary, "╭" + "─".repeat(width) + "╮");
  const bottom = colored(colors.secondary, "╰" + "─".repeat(width) + "╯");
  const body = lines
    .map((line) => (
      colored(colors.secondary, "│") +
      "  " +
      colored(colors.tertiary, line.padEnd(width - 2)) +
      colored(colors.secondary, "│")
    ))
    .join("\n");

  return "\n" + top + "\n" + body + "\n" + bottom;
}

function wrapHelpLine(command, description, width = 54) {
  const head = `  ${colored(colors.success, command)} `;
  const continuation = " ".repeat(command.length + 4);
  const words = description.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines
    .map((line, index) => (index === 0 ? head + line : continuation + line))
    .join("\n");
}

function sceneInit() {
  return [
    renderBanner(),
    renderDivider(),
    renderSectionTitle("Configured"),
    renderSuccessItem(".cursor/mcp.json (Cursor, workspace)"),
    renderSuccessItem(".vscode/mcp.json (VS Code, workspace)"),
    renderSectionTitle("Already configured"),
    renderSkipItem(".mcp.json (Claude Code) - already exists"),
    renderSkipItem(".codex/config.toml (Codex CLI) - already exists"),
    "",
    renderSuccessItem("MCP config is ready. Now let your agent lint your context files."),
    renderNextStep("Run `agent-lint doctor` to scan your workspace."),
    "",
  ].join("\n");
}

function sceneDoctor() {
  return [
    renderBanner(),
    renderDivider(),
    renderStatusBar([
      { label: "Found", value: 9, color: colors.success },
      { label: "Missing", value: 0, color: colors.success },
    ]),
    renderSectionTitle("Discovered artifacts"),
    renderSuccessItem("AGENTS.md (agents)"),
    renderSuccessItem("CLAUDE.md (agents)"),
    renderSuccessItem(".cursor/rules/nextjs-app-router.mdc (rules)"),
    renderSuccessItem(".cursor/rules/tanstack-query-cache-keys.mdc (rules)"),
    renderSuccessItem(".cursor/rules/server-actions-and-zod.mdc (rules)"),
    renderSuccessItem("skills/nextjs-pr-review/SKILL.md (skills)"),
    renderSuccessItem("skills/api-route-review/SKILL.md (skills)"),
    renderSuccessItem("docs/workflows/vercel-preview-checks.md (workflows)"),
    renderSuccessItem("docs/plans/auth-and-billing-rollout.md (plans)"),
    renderNextStep("Run agent-lint prompt to get a ready-to-paste prompt for your IDE."),
    "",
  ].join("\n");
}

function scenePrompt() {
  return [
    renderBanner(),
    renderDivider(),
    "",
    " " + bold(colors.success, "+") + " " + bold(colors.success, "Copied to clipboard!") + " " + colored(colors.muted, "Paste it into your IDE chat."),
    renderPromptBox(PROMPT_WITH_REPORT),
    "   " + bold(colors.success, "+ ") + colored(colors.muted, "Using report from .agentlint-report.md"),
    "",
  ].join("\n");
}

function sceneHelp() {
  return [
    bold(colors.primary, "Usage:") + " agent-lint [options] [command]",
    "",
    colored(colors.muted, "Set up Agent Lint MCP config, scan for stale context files, and print prompts"),
    colored(colors.muted, "for your coding agent"),
    "",
    bold(colors.primary, "Options:"),
    "  " + colored(colors.success, "-V, --version") + "     output the version number",
    "  " + colored(colors.success, "-h, --help") + "        display help for command",
    "",
    bold(colors.primary, "Commands:"),
    wrapHelpLine("init [options]", INIT_DESCRIPTION),
    wrapHelpLine("doctor [options]", DOCTOR_DESCRIPTION),
    wrapHelpLine("prompt [options]", PROMPT_DESCRIPTION),
    "  " + colored(colors.success, "help [command]") + "    display help for command",
    "",
  ].join("\n");
}

const freezeArgs = [
  "--theme", "Catppuccin Mocha",
  "--border.radius", "8",
  "--window",
  "--font.size", "15",
  "--shadow.blur", "20",
  "--shadow.x", "0",
  "--shadow.y", "10",
  "--padding", "24,32,24,32",
  "--margin", "0",
  "--language", "ansi",
];

function runFreeze(ansiContent, outputPath) {
  const tmpFile = path.join(rootDir, "docs", "screenshots", "_tmp_ansi.txt");
  fs.writeFileSync(tmpFile, ansiContent, "utf-8");

  try {
    execSync(
      `freeze ${[...freezeArgs, "--output", outputPath, tmpFile].map((arg) => `"${arg}"`).join(" ")}`,
      { cwd: rootDir, stdio: "inherit" },
    );
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

const outputDir = path.join(rootDir, "docs", "screenshots");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const scenes = [
  { file: "demo-init", render: sceneInit },
  { file: "demo-doctor", render: sceneDoctor },
  { file: "demo-prompt", render: scenePrompt },
  { file: "demo-help", render: sceneHelp },
];

const requestedScenes = new Set(process.argv.slice(2));
const scenesToRender = requestedScenes.size === 0
  ? scenes
  : scenes.filter((scene) => requestedScenes.has(scene.file));

if (requestedScenes.size > 0 && scenesToRender.length === 0) {
  throw new Error(`No matching scenes found for: ${[...requestedScenes].join(", ")}`);
}

for (const scene of scenesToRender) {
  const ansi = scene.render();
  for (const ext of ["png", "svg"]) {
    const outputPath = path.join(outputDir, `${scene.file}.${ext}`);
    process.stderr.write(`Generating ${outputPath}...\n`);
    runFreeze(ansi, outputPath);
    process.stderr.write(`  OK ${outputPath}\n`);
  }
}

process.stderr.write("\nAll screenshots generated.\n");
