import React, { useState, useEffect } from "react";
import fs from "node:fs";
import path from "node:path";
import { Box, render, useApp } from "ink";
import { Spinner } from "@inkjs/ui";
import { buildWorkspaceAutofixPlan } from "@agent-lint/core";
import {
  Banner,
  ContinuePrompt,
  SectionTitle,
  SuccessItem,
  ErrorItem,
  InfoItem,
  NextStep,
  Divider,
  StatusBar,
} from "../ui/components.js";
import { colors } from "../ui/theme.js";

const REPORT_FILENAME = ".agentlint-report.md";

export type DoctorResult = {
  discoveredCount: number;
  missingCount: number;
  incompleteCount: number;
  staleCount: number;
  conflictingCount: number;
  weakCount: number;
  recommendedPromptMode: "broad-scan" | "targeted-maintenance";
  discovered: string[];
  missing: string[];
  markdown: string;
  /** Only present when --save-report was used */
  reportPath?: string;
  /** Only present when --save-report was used */
  reportSaved?: boolean;
  /** Only present when --save-report write failed */
  reportError?: string;
};

export interface DoctorAppProps {
  /** When provided, called instead of process exit (embedded mode) */
  onComplete?: (result: DoctorResult) => void;
  /** Whether to show banner (standalone mode). Default: true */
  showBanner?: boolean;
  /** Whether to persist the report to .agentlint-report.md */
  saveReport?: boolean;
}

type DoctorScanResult = Omit<DoctorResult, "reportPath" | "reportSaved" | "reportError">;

function formatMissingArtifact(rootPath: string, suggestedPath: string, type: string): string {
  const relativeSuggestedPath =
    (path.relative(rootPath, suggestedPath) || suggestedPath).replace(/\\/g, "/");
  return `${type} -> ${relativeSuggestedPath}`;
}

function buildDoctorScanResult(rootPath: string): DoctorScanResult {
  const plan = buildWorkspaceAutofixPlan(rootPath);
  const { discoveryResult } = plan;

  return {
    discoveredCount: discoveryResult.discovered.length,
    missingCount: plan.summary.missingCount,
    incompleteCount: plan.summary.incompleteCount,
    staleCount: plan.summary.staleCount,
    conflictingCount: plan.summary.conflictingCount,
    weakCount: plan.summary.weakCount,
    recommendedPromptMode: plan.summary.recommendedPromptMode,
    discovered: discoveryResult.discovered.map(
      (d) => `${d.relativePath} (${d.type})`,
    ),
    missing: discoveryResult.missing.map((m) =>
      formatMissingArtifact(rootPath, m.suggestedPath, m.type),
    ),
    markdown: plan.markdown,
  };
}

function persistDoctorReport(rootPath: string, markdown: string): {
  reportPath: string;
  reportSaved: boolean;
  reportError?: string;
} {
  const reportPath = path.join(rootPath, REPORT_FILENAME);

  try {
    fs.writeFileSync(reportPath, markdown, "utf-8");

    const stats = fs.statSync(reportPath);
    const content = fs.readFileSync(reportPath, "utf-8");
    if (!stats.isFile() || content.trim().length === 0) {
      return {
        reportPath,
        reportSaved: false,
        reportError: "Report file verification failed after write.",
      };
    }

    return {
      reportPath,
      reportSaved: true,
    };
  } catch (error) {
    return {
      reportPath,
      reportSaved: false,
      reportError: error instanceof Error ? error.message : "Unknown report write error.",
    };
  }
}

function runDoctor(rootPath: string = process.cwd(), saveReport = false): DoctorResult {
  const scanResult = buildDoctorScanResult(rootPath);

  if (saveReport) {
    const persistence = persistDoctorReport(rootPath, scanResult.markdown);
    return { ...scanResult, ...persistence };
  }

  return scanResult;
}

export function DoctorApp({ onComplete, showBanner = true, saveReport = false }: DoctorAppProps): React.ReactNode {
  const { exit } = useApp();
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const [result, setResult] = useState<DoctorResult | null>(null);

  useEffect(() => {
    const id = setImmediate(() => {
      const r = runDoctor(process.cwd(), saveReport);

      setResult(r);
      setPhase("done");
    });
    return () => clearImmediate(id);
  }, [saveReport]);

  useEffect(() => {
    if (phase !== "done" || onComplete) {
      return;
    }

    const id = setTimeout(() => exit(), 500);
    return () => clearTimeout(id);
  }, [exit, onComplete, phase]);

  return (
    <Box flexDirection="column">
      {showBanner && (
        <>
          <Banner />
          <Divider />
        </>
      )}

      {phase === "scanning" && (
        <Box marginTop={1} marginLeft={2}>
          <Spinner label="Scanning workspace for context artifacts..." />
        </Box>
      )}

      {phase === "done" && result && (
        <>
          <StatusBar
            items={[
              {
                label: "Found",
                value: result.discoveredCount,
                color: result.discoveredCount > 0 ? colors.success : colors.warning,
              },
              {
                label: "Missing Types",
                value: result.missingCount,
                color: result.missingCount > 0 ? colors.warning : colors.muted,
              },
              {
                label: "Incomplete",
                value: result.incompleteCount,
                color: result.incompleteCount > 0 ? colors.warning : colors.muted,
              },
              {
                label: "Stale",
                value: result.staleCount,
                color: result.staleCount > 0 ? colors.warning : colors.muted,
              },
              {
                label: "Conflicting",
                value: result.conflictingCount,
                color: result.conflictingCount > 0 ? colors.warning : colors.muted,
              },
              {
                label: "Weak",
                value: result.weakCount,
                color: result.weakCount > 0 ? colors.warning : colors.muted,
              },
            ]}
          />

          <SectionTitle>Discovered artifacts</SectionTitle>
          {result.discovered.length > 0 ? (
            result.discovered.map((item) => (
              <SuccessItem key={item}>{item}</SuccessItem>
            ))
          ) : (
            <InfoItem>No context artifact files found.</InfoItem>
          )}

          {result.reportSaved === true && result.reportPath && (
            <>
              <SectionTitle>Report saved</SectionTitle>
              <InfoItem>{path.relative(process.cwd(), result.reportPath) || REPORT_FILENAME}</InfoItem>
            </>
          )}

          {result.reportSaved === false && result.reportError && (
            <>
              <SectionTitle>Report not saved</SectionTitle>
              <ErrorItem>{result.reportError}</ErrorItem>
            </>
          )}

          <SectionTitle>Recommended flow</SectionTitle>
          <InfoItem>
            {result.recommendedPromptMode === "broad-scan"
              ? "Run a broad maintenance handoff next. Missing or grouped findings suggest a full workspace pass."
              : "Run a targeted maintenance handoff next. This workspace is better suited to focused artifact updates."}
          </InfoItem>

          <SectionTitle>Remediation order</SectionTitle>
          <InfoItem>1. Fix missing artifact types and incomplete files first.</InfoItem>
          <InfoItem>2. Remove security and hygiene issues such as wrong-tool guidance.</InfoItem>
          <InfoItem>3. Repair stale references and canonical-path drift.</InfoItem>
          <InfoItem>4. Strengthen weak-but-present guidance last.</InfoItem>

          {!onComplete && (
            <NextStep>
              {result.recommendedPromptMode === "broad-scan"
                ? `Run ${"agent-lint prompt"} to get a broad workspace maintenance prompt for your IDE.`
                : `Run ${"agent-lint prompt"} to get a targeted maintenance prompt for your IDE.`}
            </NextStep>
          )}

          {onComplete && (
            <ContinuePrompt
              onContinue={() => onComplete(result)}
            />
          )}
        </>
      )}
    </Box>
  );
}

export function runDoctorCommand(options: {
  stdout?: boolean;
  json?: boolean;
  saveReport?: boolean;
}): void {
  const rootPath = process.cwd();

  if (options.json) {
    const plan = buildWorkspaceAutofixPlan(rootPath);
    process.stdout.write(JSON.stringify({ ...plan.discoveryResult, summary: plan.summary }, null, 2) + "\n");
    return;
  }

  if (options.stdout) {
    const result = buildDoctorScanResult(rootPath);
    process.stdout.write(result.markdown + "\n");
    return;
  }

  render(<DoctorApp showBanner={true} saveReport={options.saveReport} />);
}
