import { readFileSync } from "node:fs";

declare const __CLI_VERSION__: string;

function resolveVersion(): string {
  if (typeof __CLI_VERSION__ !== "undefined" && __CLI_VERSION__.length > 0) {
    return __CLI_VERSION__;
  }

  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
    ) as { version?: string };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through to the development default when package metadata is unavailable.
  }

  return "0.0.0-dev";
}

export const VERSION: string = resolveVersion();

export const colors = {
  primary: "#84B179",
  secondary: "#A2CB8B",
  tertiary: "#C7EABB",
  accent: "#E8F5BD",
  dim: "#555555",
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  muted: "#777777",
  bg: "#1a1a2e",
} as const;

export const gradient = [
  "#84B179",
  "#93BE82",
  "#A2CB8B",
  "#B5DAA3",
  "#C7EABB",
  "#D8EFBC",
  "#E8F5BD",
] as const;

export const BANNER_LINES = [
  " █████╗  ██████╗ ███████╗███╗   ██╗████████╗",
  "██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝",
  "███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ",
  "██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ",
  "██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ",
  "╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ",
];

export const BANNER_LINES_2 = [
  "██╗     ██╗███╗   ██╗████████╗",
  "██║     ██║████╗  ██║╚══██╔══╝",
  "██║     ██║██╔██╗ ██║   ██║   ",
  "██║     ██║██║╚██╗██║   ██║   ",
  "███████╗██║██║ ╚████║   ██║   ",
  "╚══════╝╚═╝╚═╝  ╚═══╝   ╚═╝   ",
];

export const TAGLINE = "Keep AGENTS.md, CLAUDE.md, rules, skills, workflows, and plans structured, current, and codebase-aware.";
