import React, { useState, useCallback } from "react";
import { Box, useApp } from "ink";
import { Banner, Divider } from "./ui/components.js";
import { MainMenu, type MenuCommand } from "./ui/main-menu.js";
import { NextAction, type NextActionContext, type NextActionChoice } from "./ui/next-action.js";
import { InitWizard, type ClientInstallResult } from "./commands/init.js";
import { DoctorApp } from "./commands/doctor.js";
import { PromptApp, type PromptResult } from "./commands/prompt.js";

// ── State Machine ──────────────────────────────────────────────────────

type AppScreen =
  | { type: "menu" }
  | { type: "command"; command: MenuCommand }
  | { type: "next-action"; context: NextActionContext };

export function resolvePromptHasReport(sessionHasReport: boolean, promptResultHasReport: boolean): boolean {
  return sessionHasReport || promptResultHasReport;
}

// ── App Component ──────────────────────────────────────────────────────

export function App(): React.ReactNode {
  const { exit } = useApp();
  const [screen, setScreen] = useState<AppScreen>({ type: "menu" });

  // Track state for smart suggestions
  const [hasReport, setHasReport] = useState(false);

  // ── Menu Selection ─────────────────────────────────────────────────

  const handleMenuSelect = useCallback((command: MenuCommand) => {
    if (command === "exit") {
      exit();
      return;
    }
    setScreen({ type: "command", command });
  }, [exit]);

  // ── Command Completion Callbacks ───────────────────────────────────

  const handleInitComplete = useCallback((results: ClientInstallResult[]) => {
    const created = results.some(
      (r) => r.result.status === "created" || r.result.status === "merged" || r.result.status === "cli-success",
    );
    setScreen({
      type: "next-action",
      context: {
        completedCommand: "init",
        initCreatedConfigs: created,
        hasReport,
      },
    });
  }, [hasReport]);

  const handleDoctorComplete = useCallback(() => {
    // Doctor always creates a report
    setHasReport(true);
    setScreen({
      type: "next-action",
      context: {
        completedCommand: "doctor",
        hasReport: true,
      },
    });
  }, []);

  const handlePromptComplete = useCallback((result: PromptResult) => {
    const effectiveHasReport = resolvePromptHasReport(hasReport, result.hasReport);
    if (effectiveHasReport !== hasReport) {
      setHasReport(effectiveHasReport);
    }
    setScreen({
      type: "next-action",
      context: {
        completedCommand: "prompt",
        hasReport: effectiveHasReport,
      },
    });
  }, [hasReport]);

  // ── Next Action Selection ──────────────────────────────────────────

  const handleNextAction = useCallback((choice: NextActionChoice) => {
    if (choice === "exit") {
      exit();
      return;
    }
    if (choice === "menu") {
      setScreen({ type: "menu" });
      return;
    }
    // Navigate to selected command
    setScreen({ type: "command", command: choice });
  }, [exit]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column">
      {/* Banner — shown once at the top, always visible */}
      <Banner />
      <Divider />

      {/* Menu Screen */}
      {screen.type === "menu" && (
        <MainMenu onSelect={handleMenuSelect} />
      )}

      {/* Command Screens (embedded mode — no banner, with onComplete) */}
      {screen.type === "command" && screen.command === "init" && (
        <InitWizard
          options={{}}
          onComplete={handleInitComplete}
          showBanner={false}
        />
      )}

      {screen.type === "command" && screen.command === "doctor" && (
        <DoctorApp
          onComplete={handleDoctorComplete}
          showBanner={false}
        />
      )}

      {screen.type === "command" && screen.command === "prompt" && (
        <PromptApp
          onComplete={handlePromptComplete}
          showBanner={false}
        />
      )}

      {/* Next Action Screen */}
      {screen.type === "next-action" && (
        <NextAction
          context={screen.context}
          onSelect={handleNextAction}
        />
      )}
    </Box>
  );
}
