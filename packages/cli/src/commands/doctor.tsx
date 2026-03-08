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
  discovered: string[];
  missing: string[];
  markdown: string;
  reportPath: string;
  reportSaved: boolean;
  reportError?: string;
};

export interface DoctorAppProps {
  /** When provided, called instead of process exit (embedded mode) */
  onComplete?: (result: DoctorResult) => void;
  /** Whether to show banner (standalone mode). Default: true */
  showBanner?: boolean;
}

type DoctorScanResult = Omit<DoctorResult, "reportPath" | "reportSaved" | "reportError">;

function formatMissingArtifact(rootPath: string, suggestedPath: string, type: string): string {
  const relativeSuggestedPath = path.relative(rootPath, suggestedPath) || suggestedPath;
  return `${type} -> ${relativeSuggestedPath}`;
}

function buildDoctorScanResult(rootPath: string): DoctorScanResult {
  const plan = buildWorkspaceAutofixPlan(rootPath);
  const { discoveryResult } = plan;

  return {
    discoveredCount: discoveryResult.discovered.length,
    missingCount: discoveryResult.missing.length,
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

function runDoctor(rootPath: string = process.cwd()): DoctorResult {
  const scanResult = buildDoctorScanResult(rootPath);
  const persistence = persistDoctorReport(rootPath, scanResult.markdown);

  return {
    ...scanResult,
    ...persistence,
  };
}

export function DoctorApp({ onComplete, showBanner = true }: DoctorAppProps): React.ReactNode {
  const { exit } = useApp();
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const [result, setResult] = useState<DoctorResult | null>(null);

  useEffect(() => {
    const id = setImmediate(() => {
      const r = runDoctor();

      setResult(r);
      setPhase("done");
    });
    return () => clearImmediate(id);
  }, []);

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
                label: "Missing",
                value: result.missingCount,
                color: result.missingCount > 0 ? colors.warning : colors.success,
              },
            ]}
          />

          {result.discovered.length > 0 && (
            <>
              <SectionTitle>Discovered artifacts</SectionTitle>
              {result.discovered.map((item, i) => (
                <SuccessItem key={i}>{item}</SuccessItem>
              ))}
            </>
          )}

          {result.missing.length > 0 && (
            <>
              <SectionTitle>Missing artifact types</SectionTitle>
              {result.missing.map((item, i) => (
                <ErrorItem key={i}>{item}</ErrorItem>
              ))}
            </>
          )}

          {result.reportSaved ? (
            <>
              <SectionTitle>Report saved</SectionTitle>
              <InfoItem>{path.relative(process.cwd(), result.reportPath) || REPORT_FILENAME}</InfoItem>
            </>
          ) : (
            <>
              <SectionTitle>Report not saved</SectionTitle>
              <ErrorItem>{result.reportError ?? "Unknown report write error."}</ErrorItem>
            </>
          )}

          <NextStep>
            {result.reportSaved
              ? `Run ${"agent-lint prompt"} to get a ready-to-paste prompt for your IDE.`
              : `Fix the report write issue and run ${"agent-lint doctor"} again.`}
          </NextStep>

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
}): void {
  const rootPath = process.cwd();

  if (options.json) {
    const plan = buildWorkspaceAutofixPlan(rootPath);
    process.stdout.write(JSON.stringify(plan.discoveryResult, null, 2) + "\n");
    return;
  }

  if (options.stdout) {
    const result = buildDoctorScanResult(rootPath);
    process.stdout.write(result.markdown + "\n");
    return;
  }

  render(<DoctorApp showBanner={true} />);
}
