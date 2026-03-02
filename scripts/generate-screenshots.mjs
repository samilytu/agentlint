#!/usr/bin/env node

/**
 * Generates clean ANSI-colored terminal output that matches the Ink TUI,
 * then pipes through `freeze` to create beautiful PNG screenshots.
 *
 * Usage: node scripts/generate-screenshots.mjs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// --- Theme (matches packages/cli/src/ui/theme.ts) ---

const colors = {
  primary: "#6367FF",
  secondary: "#8494FF",
  tertiary: "#C9BEFF",
  accent: "#FFDBFD",
  dim: "#555555",
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  muted: "#777777",
};

const gradient = [
  "#6367FF",
  "#7078FF",
  "#8494FF",
  "#A3A9FF",
  "#C9BEFF",
  "#E4CCFE",
  "#FFDBFD",
];

// --- ANSI helpers ---

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

// --- Components (match packages/cli/src/ui/components.tsx) ---

const BANNER_LINES = [
  " █████╗  ██████╗ ███████╗███╗   ██╗████████╗",
  "██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝",
  "███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ",
  "██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ",
  "██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ",
  "╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ",
];

const BANNER_LINES_2 = [
  "██╗     ██╗███╗   ██╗████████╗",
  "██║     ██║████╗  ██║╚══██╔══╝",
  "██║     ██║██╔██╗ ██║   ██║   ",
  "██║     ██║██║╚██╗██║   ██║   ",
  "███████╗██║██║ ╚████║   ██║   ",
  "╚══════╝╚═╝╚═╝  ╚═══╝   ╚═╝   ",
];

const TAGLINE = "Meta-agent orchestrator for AI coding agents";
const VERSION = "0.3.1";

function renderBanner() {
  const lines = [];
  for (let i = 0; i < BANNER_LINES.length; i++) {
    const g = gradient[i] ?? gradient[gradient.length - 1];
    lines.push(bold(g, BANNER_LINES[i]) + " " + bold(g, BANNER_LINES_2[i] ?? ""));
  }
  lines.push(
    " " + bold(colors.accent, "*") + " " + italic(colors.tertiary, TAGLINE) + " " + colored(colors.dim, `v${VERSION}`)
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

function renderErrorItem(text) {
  return "   " + bold(colors.error, "x ") + text;
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
  return " ┌─────────────────────────────┐\n │  " + inner + "  │\n └─────────────────────────────┘";
}

function renderPromptBox(text) {
  const border = colors.secondary;
  const maxW = 72;
  const lines = [];
  const words = text.split(" ");
  let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);

  const width = Math.max(...lines.map((l) => l.length)) + 4;
  const top = colored(border, "╭" + "─".repeat(width) + "╮");
  const bot = colored(border, "╰" + "─".repeat(width) + "╯");
  const body = lines
    .map((l) => colored(border, "│") + "  " + colored(colors.tertiary, l.padEnd(width - 2)) + colored(border, "│"))
    .join("\n");
  return "\n" + top + "\n" + body + "\n" + bot;
}

function renderHint(text) {
  return "\n   " + colored(colors.tertiary, "? ") + italic(colors.muted, text);
}

// --- Scenes ---

function sceneInit() {
  const lines = [
    renderBanner(),
    renderDivider(),
    renderSectionTitle("Created"),
    renderSuccessItem(".vscode/mcp.json (VS Code)"),
    renderSectionTitle("Skipped"),
    renderSkipItem(".windsurf/mcp_config.json (Windsurf) — already exists"),
    renderSectionTitle("Manual steps"),
    renderInfoItem("Claude Code CLI: Run: claude mcp add agentlint -- npx -y @agent-lint/mcp"),
    renderNextStep('Run `agent-lint doctor` to scan your workspace.'),
    "",
  ];
  return lines.join("\n");
}

function sceneDoctor() {
  const lines = [
    renderBanner(),
    renderDivider(),
    renderStatusBar([
      { label: "Found", value: 24, color: colors.success },
      { label: "Missing", value: 0, color: colors.success },
    ]),
    renderSectionTitle("Discovered artifacts"),
    renderSuccessItem(".windsurf/rules/deneme-rule1.md (rules)"),
    renderSuccessItem(".windsurf/skills/testing/SKILL.md (skills)"),
    renderSuccessItem("AGENTS.md (agents)"),
    renderSuccessItem("docs/great_plan.md (plans)"),
    renderSuccessItem("examples/github-action.yml (agents)"),
    renderSuccessItem("fixtures/good-agents.md (agents)"),
    renderSuccessItem("fixtures/good-plans.md (plans)"),
    renderSuccessItem("fixtures/good-rules.md (rules)"),
    renderSuccessItem("fixtures/good-skills.md (skills)"),
    renderSuccessItem("fixtures/good-workflows.md (workflows)"),
    renderSuccessItem("packages/cli/README.md (agents)"),
    renderSuccessItem("packages/mcp/README.md (agents)"),
    renderSuccessItem("README.md (agents)"),
    renderSectionTitle("Report saved"),
    renderInfoItem(".agentlint-report.md"),
    renderNextStep("Run agent-lint prompt to get a copy-paste prompt for your IDE."),
    "",
  ];
  return lines.join("\n");
}

function scenePrompt() {
  const prompt =
    "Read the file .agentlint-report.md in this project and execute all " +
    "recommended fixes. Use the agentlint MCP tools " +
    "(agentlint_get_guidelines, agentlint_plan_workspace_autofix) for " +
    "detailed guidelines on each artifact type. Apply all changes directly.";

  const lines = [
    renderBanner(),
    renderDivider(),
    "\n " + bold(colors.success, "+") + " " + bold(colors.success, "Copied to clipboard!") + " " + colored(colors.muted, "Paste it into your IDE chat."),
    renderPromptBox(prompt),
    "   " + bold(colors.success, "+ ") + colored(colors.muted, "Using report from .agentlint-report.md"),
    "",
  ];
  return lines.join("\n");
}

function sceneHelp() {
  const lines = [
    bold(colors.primary, "Usage:") + " agent-lint [options] [command]",
    "",
    colored(colors.muted, "Meta-agent orchestrator for AI coding agent context artifacts"),
    "",
    bold(colors.primary, "Options:"),
    "  " + colored(colors.success, "-V, --version") + "     output the version number",
    "  " + colored(colors.success, "-h, --help") + "        display help for command",
    "",
    bold(colors.primary, "Commands:"),
    "  " + colored(colors.success, "init") + " [options]    Set up Agent Lint MCP config for detected IDE clients",
    "  " + colored(colors.success, "doctor") + " [options]  Scan workspace for context artifacts and generate a fix report",
    "  " + colored(colors.success, "prompt") + " [options]  Print a copy-paste prompt for your IDE chat to trigger autofix",
    "  " + colored(colors.success, "help") + " [command]    display help for command",
    "",
  ];
  return lines.join("\n");
}

// --- Freeze runner ---

const FREEZE_COMMON = [
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
  const tmpFile = path.join("docs", "screenshots", "_tmp_ansi.txt");
  fs.writeFileSync(tmpFile, ansiContent, "utf-8");

  const args = [...FREEZE_COMMON, "--output", outputPath, tmpFile];
  try {
    execSync(`freeze ${args.map((a) => `"${a}"`).join(" ")}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// --- Main ---

const outDir = path.join("docs", "screenshots");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const scenes = [
  { name: "init", fn: sceneInit, file: "demo-init" },
  { name: "doctor", fn: sceneDoctor, file: "demo-doctor" },
  { name: "prompt", fn: scenePrompt, file: "demo-prompt" },
  { name: "help", fn: sceneHelp, file: "demo-help" },
];

for (const scene of scenes) {
  const ansi = scene.fn();
  for (const ext of ["png", "svg"]) {
    const out = path.join(outDir, `${scene.file}.${ext}`);
    process.stderr.write(`Generating ${out}...\n`);
    runFreeze(ansi, out);
    process.stderr.write(`  ✓ ${out}\n`);
  }
}

process.stderr.write("\nAll screenshots generated.\n");
