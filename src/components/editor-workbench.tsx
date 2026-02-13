"use client";

import { useState } from "react";

import { ArtifactSelector } from "@/components/artifact-selector";
import { DiffViewer } from "@/components/diff-viewer";
import { InputPanel } from "@/components/input-panel";
import { JudgeToolbar } from "@/components/judge-toolbar";
import { OutputPanel } from "@/components/output-panel";
import { RecentScans } from "@/components/recent-scans";
import { ScoreDisplay } from "@/components/score-display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ArtifactType } from "@/lib/artifacts";
import { api } from "@/trpc/react";

const starterTemplates: Record<ArtifactType, string> = {
  skills: [
    "---",
    "name: safe-deploy-skill",
    "description: Deploy flow with explicit confirmations",
    "---",
    "",
    "# Inputs",
    "- environment: staging|production",
    "",
    "# Guardrails",
    "- Never force push",
    "- Ask user confirmation before prod deploy",
  ].join("\n"),
  agents: [
    "# AGENTS.md",
    "",
    "## Project Context",
    "- Stack: Next.js + TypeScript",
    "",
    "## Critical Rules",
    "- Run lint before finalizing",
    "- Avoid destructive git operations",
  ].join("\n"),
  rules: [
    "# Workspace Rules",
    "",
    "- No any types",
    "- Use App Router conventions",
    "- Require confirmation for dangerous commands",
  ].join("\n"),
  workflows: [
    "# Workflow: Release Patch",
    "",
    "1. Run tests",
    "2. Build app",
    "3. Ask confirmation",
    "4. Create release notes",
  ].join("\n"),
  plans: [
    "# Great Plan",
    "",
    "## Phase 1",
    "- Setup baseline stack",
    "",
    "## Exit Criteria",
    "- CI passes",
    "- Docs updated",
  ].join("\n"),
};

export function EditorWorkbench() {
  const utils = api.useUtils();
  const [artifactType, setArtifactType] = useState<ArtifactType>("agents");
  const [input, setInput] = useState(starterTemplates.agents);
  const [output, setOutput] = useState("");

  const recentScans = api.artifacts.listRecent.useQuery();
  const analyzeMutation = api.artifacts.analyze.useMutation({
    onSuccess: async ({ result }) => {
      setOutput(result.refinedContent);
      await utils.artifacts.listRecent.invalidate();
    },
  });

  async function onAnalyze() {
    await analyzeMutation.mutateAsync({
      type: artifactType,
      content: input,
    });
  }

  function onLoadTemplate(next: ArtifactType) {
    setArtifactType(next);
    setInput(starterTemplates[next]);
    setOutput("");
  }

  function onApplyFix() {
    if (output.length > 0) {
      setInput(output);
    }
  }

  async function onCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  }

  function onExport() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${artifactType}-refined.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const scoreData = analyzeMutation.data
    ? {
        score: analyzeMutation.data.result.score,
        provider: analyzeMutation.data.provider,
        dimensions: analyzeMutation.data.result.dimensions,
        warnings: analyzeMutation.data.result.warnings,
      }
    : null;

  return (
    <div className="flex flex-col gap-5">
      <Card className="panel-glow border-border/50 bg-card/75">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.1em] font-[family-name:var(--font-display)]">
            Artifact Type
          </CardTitle>
          <CardDescription className="text-xs">
            Select what to evaluate, then run the judge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArtifactSelector selected={artifactType} onSelect={onLoadTemplate} />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <InputPanel value={input} onChange={setInput} />
        <OutputPanel value={output} isLoading={analyzeMutation.isPending} />
      </section>

      <Card className="panel-glow border-border/50 bg-card/75">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.1em] font-[family-name:var(--font-display)]">
            Judge & Actions
          </CardTitle>
          <CardDescription className="text-xs">
            Run analysis, apply fixes, and export improved artifacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <JudgeToolbar
            isPending={analyzeMutation.isPending}
            hasOutput={output.length > 0}
            inputLength={input.length}
            isOverLimit={input.length > 1_000_000}
            errorMessage={analyzeMutation.error?.message ?? null}
            onAnalyze={onAnalyze}
            onApplyFix={onApplyFix}
            onCopy={onCopy}
            onExport={onExport}
          />
          <Separator className="bg-border/30" />
          <ScoreDisplay data={scoreData} isLoading={analyzeMutation.isPending} />
        </CardContent>
      </Card>

      <DiffViewer original={input} refined={output} />

      <RecentScans
        scans={recentScans.data}
        isLoading={recentScans.isLoading}
      />
    </div>
  );
}
