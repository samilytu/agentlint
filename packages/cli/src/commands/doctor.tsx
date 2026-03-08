import React, { useState, useEffect } from "react";
import fs from "node:fs";
import path from "node:path";
import { Box, render } from "ink";
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
};

export interface DoctorAppProps {
  /** When provided, called instead of process exit (embedded mode) */
  onComplete?: (result: DoctorResult) => void;
  /** Whether to show banner (standalone mode). Default: true */
  showBanner?: boolean;
}

function runDoctor(): DoctorResult {
  const rootPath = process.cwd();
  const plan = buildWorkspaceAutofixPlan(rootPath);
  const { discoveryResult } = plan;

  return {
    discoveredCount: discoveryResult.discovered.length,
    missingCount: discoveryResult.missing.length,
    discovered: discoveryResult.discovered.map(
      (d) => `${d.relativePath} (${d.type})`,
    ),
    missing: discoveryResult.missing.map((m) => String(m)),
    markdown: plan.markdown,
  };
}

export function DoctorApp({ onComplete, showBanner = true }: DoctorAppProps): React.ReactNode {
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const [result, setResult] = useState<DoctorResult | null>(null);

  useEffect(() => {
    const id = setImmediate(() => {
      const r = runDoctor();

      const reportPath = path.join(process.cwd(), REPORT_FILENAME);
      fs.writeFileSync(reportPath, r.markdown, "utf-8");

      setResult(r);
      setPhase("done");
    });
    return () => clearImmediate(id);
  }, []);

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

          <SectionTitle>Report saved</SectionTitle>
          <InfoItem>{REPORT_FILENAME}</InfoItem>

          <NextStep>
            {`Run ${"agent-lint prompt"} to get a ready-to-paste prompt for your IDE.`}
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
  if (options.json) {
    const rootPath = process.cwd();
    const plan = buildWorkspaceAutofixPlan(rootPath);
    process.stdout.write(JSON.stringify(plan.discoveryResult, null, 2) + "\n");
    return;
  }

  if (options.stdout) {
    const result = runDoctor();
    process.stdout.write(result.markdown + "\n");
    return;
  }

  render(<DoctorApp showBanner={true} />);
}
