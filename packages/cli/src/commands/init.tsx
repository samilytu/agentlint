import React, { useState, useEffect } from "react";
import { Box, Text, render, useApp } from "ink";
import { Spinner, MultiSelect, Select } from "@inkjs/ui";
import {
  Banner,
  SectionTitle,
  SuccessItem,
  SkipItem,
  ErrorItem,
  NextStep,
  Divider,
} from "../ui/components.js";
import { colors } from "../ui/theme.js";
import {
  type McpClient,
  type ClientId,
  type Scope,
  type DetectedClient,
  CLIENT_REGISTRY,
  detectInstalledClients,
  getAvailableScopes,
} from "./clients.js";
import { type InstallResult, installClient } from "./config-writer.js";

// ── Types ──────────────────────────────────────────────────────────────

type WizardStep = "detecting" | "selectClients" | "selectScope" | "installing" | "done";

export interface ClientInstallResult {
  client: McpClient;
  scope: Scope;
  result: InstallResult;
}

export interface InitWizardProps {
  options: { yes?: boolean; all?: boolean };
  /** When provided, called instead of process exit (embedded mode) */
  onComplete?: (results: ClientInstallResult[]) => void;
  /** Whether to show banner (standalone mode). Default: true */
  showBanner?: boolean;
}

// ── Stdout Mode (backward compat) ──────────────────────────────────────

function runStdoutInit(options: { yes?: boolean; all?: boolean }): void {
  const cwd = process.cwd();
  const detected = detectInstalledClients(cwd);
  const clients = options.all
    ? CLIENT_REGISTRY
    : detected.map((d) => d.client);

  if (clients.length === 0) {
    process.stdout.write("No IDE client directories detected.\n");
    return;
  }

  for (const client of clients) {
    const scopes = getAvailableScopes(client);
    const scope = scopes.includes("workspace") ? "workspace" : "global";
    const result = installClient(client, scope, cwd, /* preferCli */ false);

    switch (result.status) {
      case "created":
      case "merged":
        process.stdout.write(`[created] ${result.configPath} (${client.name})\n`);
        break;
      case "exists":
        process.stdout.write(`[skip] ${result.configPath} (${client.name}) — already exists\n`);
        break;
      case "cli-success":
        process.stdout.write(`[created] ${client.name} via CLI: ${result.message}\n`);
        break;
      case "no-scope":
      case "error":
        process.stdout.write(`[note] ${client.name}: ${result.message}\n`);
        break;
    }
  }
}

// ── Wizard Component ───────────────────────────────────────────────────

export function InitWizard({ options, onComplete, showBanner = true }: InitWizardProps): React.ReactNode {
  const { exit } = useApp();
  const cwd = process.cwd();

  const [step, setStep] = useState<WizardStep>("detecting");
  const [detected, setDetected] = useState<DetectedClient[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<ClientId[]>([]);
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null);
  const [results, setResults] = useState<ClientInstallResult[]>([]);

  // Step 1: Auto-detect clients
  useEffect(() => {
    const id = setImmediate(() => {
      const found = detectInstalledClients(cwd);
      setDetected(found);

      if (options.all) {
        // --all: skip selection, use all clients
        setSelectedClientIds(CLIENT_REGISTRY.map((c) => c.id));
        setStep("selectScope");
      } else {
        setStep("selectClients");
      }
    });
    return () => clearImmediate(id);
  }, []);

  // Step 4: Install configs when scope is selected
  useEffect(() => {
    if (step !== "installing") return;
    if (!selectedScope) return;

    const id = setImmediate(() => {
      const installResults: ClientInstallResult[] = [];
      const selectedClients = CLIENT_REGISTRY.filter((c) =>
        selectedClientIds.includes(c.id),
      );

      for (const client of selectedClients) {
        const result = installClient(client, selectedScope, cwd);
        installResults.push({ client, scope: selectedScope, result });
      }

      setResults(installResults);
      setStep("done");
    });
    return () => clearImmediate(id);
  }, [step, selectedScope]);

  // When done: call onComplete callback (embedded) or exit (standalone)
  useEffect(() => {
    if (step !== "done") return;
    if (onComplete) {
      // Embedded mode — notify parent, don't exit
      const id = setTimeout(() => onComplete(results), 300);
      return () => clearTimeout(id);
    }
    // Standalone mode — exit process
    const id = setTimeout(() => exit(), 500);
    return () => clearTimeout(id);
  }, [step, onComplete, results, exit]);

  // Build client options for MultiSelect
  const clientOptions = CLIENT_REGISTRY.map((client) => {
    const det = detected.find((d) => d.client.id === client.id);
    const suffix = det ? ` (detected via ${det.detectedBy})` : "";
    return {
      label: `${client.name}${suffix}`,
      value: client.id,
    };
  });

  // Pre-select detected clients
  const defaultSelected = detected.map((d) => d.client.id);

  // Scope options
  const scopeOptions = [
    { label: "Workspace — project-local config", value: "workspace" as Scope },
    { label: "Global — user-level config", value: "global" as Scope },
  ];

  return (
    <Box flexDirection="column">
      {showBanner && (
        <>
          <Banner />
          <Divider />
        </>
      )}

      {/* Step 1: Detecting */}
      {step === "detecting" && (
        <Box marginTop={1} marginLeft={2}>
          <Spinner label="Detecting installed IDE clients..." />
        </Box>
      )}

      {/* Step 2: Select Clients */}
      {step === "selectClients" && (
        <>
          {detected.length > 0 ? (
            <Box marginTop={1} marginLeft={2}>
              <Text color={colors.success} bold>{"+ "}</Text>
              <Text>
                Found {detected.length} client{detected.length !== 1 ? "s" : ""}
              </Text>
            </Box>
          ) : (
            <Box marginTop={1} marginLeft={2}>
              <Text color={colors.warning}>{"~ "}</Text>
              <Text color={colors.muted}>No clients auto-detected. Select manually:</Text>
            </Box>
          )}

          <SectionTitle>Select clients to configure</SectionTitle>
          <Box marginLeft={3} marginBottom={0}>
            <Text color={colors.dim} italic>
              {"↑/↓ navigate · space toggle · enter confirm"}
            </Text>
          </Box>
          <Box marginLeft={3} marginTop={0}>
            <MultiSelect
              options={clientOptions}
              defaultValue={defaultSelected}
              onSubmit={(values) => {
                if (values.length === 0) {
                  // Nothing selected — exit gracefully
                  setStep("done");
                  return;
                }
                setSelectedClientIds(values as ClientId[]);
                setStep("selectScope");
              }}
            />
          </Box>
        </>
      )}

      {/* Step 3: Select Scope */}
      {step === "selectScope" && (
        <>
          <Box marginTop={1} marginLeft={2}>
            <Text color={colors.success} bold>{"+ "}</Text>
            <Text>
              {selectedClientIds.length} client{selectedClientIds.length !== 1 ? "s" : ""} selected
            </Text>
          </Box>

          <SectionTitle>Select config scope</SectionTitle>
          <Box marginLeft={3} marginBottom={0}>
            <Text color={colors.dim} italic>
              {"↑/↓ navigate · enter confirm"}
            </Text>
          </Box>
          <Box marginLeft={3} marginTop={0}>
            <Select
              options={scopeOptions}
              onChange={(value) => {
                setSelectedScope(value as Scope);
                setStep("installing");
              }}
            />
          </Box>
        </>
      )}

      {/* Step 4: Installing */}
      {step === "installing" && (
        <Box marginTop={1} marginLeft={2}>
          <Spinner label="Configuring MCP servers..." />
        </Box>
      )}

      {/* Step 5: Results */}
      {step === "done" && (
        <ResultsView results={results} />
      )}
    </Box>
  );
}

// ── Results Display ────────────────────────────────────────────────────

function ResultsView({ results }: { results: ClientInstallResult[] }): React.ReactNode {
  if (results.length === 0) {
    return (
      <>
        <SectionTitle>No clients configured</SectionTitle>
        <Box marginLeft={2}>
          <Text color={colors.muted}>No clients were selected for configuration.</Text>
        </Box>
        <NextStep>{"Run agent-lint init again to set up MCP config."}</NextStep>
      </>
    );
  }

  const created = results.filter(
    (r) => r.result.status === "created" || r.result.status === "merged" || r.result.status === "cli-success",
  );
  const skipped = results.filter((r) => r.result.status === "exists");
  const errors = results.filter((r) => r.result.status === "error" || r.result.status === "no-scope");

  return (
    <>
      {created.length > 0 && (
        <>
          <SectionTitle>Configured</SectionTitle>
          {created.map((r, i) => (
            <SuccessItem key={i}>
              {r.result.status === "cli-success"
                ? `${r.client.name} (${r.scope}) via CLI`
                : `${formatPath(r.result)} (${r.client.name}, ${r.scope})`}
            </SuccessItem>
          ))}
        </>
      )}

      {skipped.length > 0 && (
        <>
          <SectionTitle>Already configured</SectionTitle>
          {skipped.map((r, i) => (
            <SkipItem key={i}>
              {`${formatPath(r.result)} (${r.client.name}) — already exists`}
            </SkipItem>
          ))}
        </>
      )}

      {errors.length > 0 && (
        <>
          <SectionTitle>Errors</SectionTitle>
          {errors.map((r, i) => (
            <ErrorItem key={i}>
              {`${r.client.name}: ${formatError(r.result)}`}
            </ErrorItem>
          ))}
        </>
      )}

      {created.length === 0 && skipped.length > 0 && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.muted}>All selected clients already have MCP config.</Text>
        </Box>
      )}

      {created.length > 0 && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.success} bold>{"✔ "}</Text>
          <Text>MCP config is ready. Now let your agent lint your context files.</Text>
        </Box>
      )}

      <NextStep>
        {`Run ${"`"}agent-lint doctor${"`"} to scan your workspace.`}
      </NextStep>
    </>
  );
}

function formatPath(result: InstallResult): string {
  if ("configPath" in result) {
    return result.configPath;
  }
  return "";
}

function formatError(result: InstallResult): string {
  if ("message" in result) {
    return result.message;
  }
  return "Unknown error";
}

// ── Export ──────────────────────────────────────────────────────────────

export function runInitCommand(options: { yes?: boolean; all?: boolean; stdout?: boolean }): void {
  if (options.stdout) {
    runStdoutInit(options);
    return;
  }

  render(<InitWizard options={options} showBanner={true} />);
}
