import fs from "node:fs";
import path from "node:path";
import { scoreArtifact } from "@agent-lint/core";
import type { ArtifactType } from "@agent-lint/shared";

// ---------------------------------------------------------------------------
// Type auto-detection from file path
// ---------------------------------------------------------------------------

function detectArtifactType(filePath: string): ArtifactType | null {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);

  if (base === "claude.md" || base === "agents.md" || lower.includes("agent")) return "agents";
  if (lower.includes("skill")) return "skills";
  if (lower.includes("rule") || lower.includes(".cursor/rules") || lower.includes(".windsurf/rules")) return "rules";
  if (lower.includes("workflow")) return "workflows";
  if (lower.includes("plan")) return "plans";

  return null;
}

// ---------------------------------------------------------------------------
// CLI command runner
// ---------------------------------------------------------------------------

export type ScoreCommandOptions = {
  type?: string;
  stdout?: boolean;
};

export function runScoreCommand(filePath: string, options: ScoreCommandOptions): void {
  // Resolve file
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    process.stderr.write(`Error: File not found: ${resolved}\n`);
    process.exit(1);
  }

  // Resolve artifact type
  let artifactType: ArtifactType | null = (options.type as ArtifactType | undefined) ?? null;
  if (!artifactType) {
    artifactType = detectArtifactType(resolved);
  }
  if (!artifactType) {
    process.stderr.write(
      `Error: Cannot detect artifact type from filename "${path.basename(resolved)}".\n` +
        `Pass --type <agents|skills|rules|workflows|plans> explicitly.\n`,
    );
    process.exit(1);
  }

  // Read content
  let content: string;
  try {
    content = fs.readFileSync(resolved, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: Cannot read file: ${msg}\n`);
    process.exit(1);
  }

  // Score
  const result = scoreArtifact(content, artifactType);
  process.stdout.write(result.markdown + "\n");
}
