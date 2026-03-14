import React, { useEffect, useState } from "react";
import { Box, Text, render, useApp } from "ink";
import { Spinner, MultiSelect, Select } from "@inkjs/ui";
import {
  Banner,
  ContinuePrompt,
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
  getDefaultSelectedClientIds,
  getAvailableScopes,
} from "./clients.js";
import { type InstallResult, installClient } from "./config-writer.js";
import {
  type MaintenanceInstallResult,
  installMaintenanceRule,
} from "./maintenance-writer.js";

type WizardStep =
  | "detecting"
  | "selectClients"
  | "selectScope"
  | "installing"
  | "confirmRules"
  | "installingRules"
  | "done";

export interface ClientInstallResult {
  client: McpClient;
  scope: Scope;
  configResult: InstallResult;
  maintenanceResult?: MaintenanceInstallResult;
}

export interface InitWizardProps {
  options: { yes?: boolean; all?: boolean; withRules?: boolean };
  onComplete?: (results: ClientInstallResult[]) => void;
  showBanner?: boolean;
}

function isConfigReady(result: InstallResult): boolean {
  return result.status === "created" ||
    result.status === "merged" ||
    result.status === "exists" ||
    result.status === "cli-success";
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

function formatMaintenance(result: MaintenanceInstallResult | undefined): string {
  if (!result) {
    return "No maintenance rule result";
  }

  if ("targetPath" in result && result.targetPath) {
    return result.targetPath;
  }

  if ("message" in result) {
    return result.message;
  }

  return "Unknown maintenance rule result";
}

function shouldPreferCliInstall(client: McpClient): boolean {
  return client.id === "claude-code";
}

function printConfigResult(client: McpClient, result: InstallResult): void {
  switch (result.status) {
    case "created":
    case "merged":
      process.stdout.write(`[created] ${result.configPath} (${client.name})\n`);
      break;
    case "exists":
      process.stdout.write(`[skip] ${result.configPath} (${client.name}) - already exists\n`);
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

function printMaintenanceResult(client: McpClient, result: MaintenanceInstallResult): void {
  switch (result.status) {
    case "created":
      process.stdout.write(`[rule created] ${result.targetPath} (${client.name})\n`);
      break;
    case "updated":
      process.stdout.write(`[rule updated] ${result.targetPath} (${client.name})\n`);
      break;
    case "appended":
      process.stdout.write(`[rule appended] ${result.targetPath} (${client.name})\n`);
      break;
    case "exists":
      process.stdout.write(`[rule skip] ${result.targetPath} (${client.name}) - already exists\n`);
      break;
    case "skipped":
      process.stdout.write(`[rule skip] ${client.name}: ${result.message}\n`);
      break;
    case "error":
      process.stdout.write(`[rule error] ${client.name}: ${result.message}\n`);
      break;
  }
}

function runStdoutInit(options: { yes?: boolean; all?: boolean; withRules?: boolean }): void {
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
    const configResult = installClient(client, scope, cwd, shouldPreferCliInstall(client));
    printConfigResult(client, configResult);

    if (!options.withRules && !options.yes) {
      continue;
    }

    if (!isConfigReady(configResult)) {
      printMaintenanceResult(client, {
        status: "skipped",
        message: "MCP config was not installed for this client.",
      });
      continue;
    }

    printMaintenanceResult(client, installMaintenanceRule(client, cwd));
  }
}

export function InitWizard({ options, onComplete, showBanner = true }: InitWizardProps): React.ReactNode {
  const { exit } = useApp();
  const cwd = process.cwd();

  const [step, setStep] = useState<WizardStep>("detecting");
  const [detected, setDetected] = useState<DetectedClient[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<ClientId[]>([]);
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null);
  const [results, setResults] = useState<ClientInstallResult[]>([]);
  const [maintenanceRequested, setMaintenanceRequested] = useState(false);

  useEffect(() => {
    const id = setImmediate(() => {
      const found = detectInstalledClients(cwd);
      setDetected(found);

      if (options.all) {
        setSelectedClientIds(CLIENT_REGISTRY.map((c) => c.id));
        setStep("selectScope");
      } else {
        setStep("selectClients");
      }
    });
    return () => clearImmediate(id);
  }, [cwd, options.all]);

  useEffect(() => {
    if (step !== "installing" || !selectedScope) {
      return;
    }

    const id = setImmediate(() => {
      const selectedClients = CLIENT_REGISTRY.filter((c) =>
        selectedClientIds.includes(c.id));
      const configResults = selectedClients.map((client) => ({
        client,
        scope: selectedScope,
        configResult: installClient(client, selectedScope, cwd, shouldPreferCliInstall(client)),
      }));

      setResults(configResults);

      if (!configResults.some((entry) => isConfigReady(entry.configResult))) {
        setStep("done");
        return;
      }

      if (options.withRules || options.yes) {
        setMaintenanceRequested(true);
        setStep("installingRules");
        return;
      }

      setStep("confirmRules");
    });

    return () => clearImmediate(id);
  }, [cwd, options.withRules, options.yes, selectedClientIds, selectedScope, step]);

  useEffect(() => {
    if (step !== "installingRules") {
      return;
    }

    const id = setImmediate(() => {
      setResults((previous) =>
        previous.map((entry) => {
          if (!isConfigReady(entry.configResult)) {
            return {
              ...entry,
              maintenanceResult: {
                status: "skipped",
                message: "MCP config was not installed for this client.",
              },
            };
          }

          return {
            ...entry,
            maintenanceResult: installMaintenanceRule(entry.client, cwd),
          };
        }));
      setStep("done");
    });

    return () => clearImmediate(id);
  }, [cwd, step]);

  useEffect(() => {
    if (step !== "done" || onComplete) {
      return;
    }

    const id = setTimeout(() => exit(), 500);
    return () => clearTimeout(id);
  }, [exit, onComplete, step]);

  const clientOptions = CLIENT_REGISTRY.map((client) => {
    const det = detected.find((d) => d.client.id === client.id);
    const suffix = det ? ` (detected via ${det.detectedBy})` : "";
    return {
      label: `${client.name}${suffix}`,
      value: client.id,
    };
  });

  const defaultSelected = getDefaultSelectedClientIds(detected, cwd);
  const scopeOptions = [
    { label: "Workspace - project-local config", value: "workspace" as Scope },
    { label: "Global - user-level config", value: "global" as Scope },
  ];

  return (
    <Box flexDirection="column">
      {showBanner && (
        <>
          <Banner />
          <Divider />
        </>
      )}

      {step === "detecting" && (
        <Box marginTop={1} marginLeft={2}>
          <Spinner label="Detecting installed IDE clients..." />
        </Box>
      )}

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

      {step === "installing" && (
        <Box marginTop={1} marginLeft={2}>
          <Spinner label="Configuring MCP servers..." />
        </Box>
      )}

      {step === "confirmRules" && (
        <>
          <Box marginTop={1} marginLeft={2}>
            <Text color={colors.success} bold>{"+ "}</Text>
            <Text>MCP setup is complete.</Text>
          </Box>

          <SectionTitle>Install maintenance rules</SectionTitle>
          <Box marginLeft={3} marginBottom={0}>
            <Text color={colors.dim} italic>
              {"↑/↓ navigate · enter confirm"}
            </Text>
          </Box>
          <Box marginLeft={3} marginTop={0}>
            <Select
              options={[
                {
                  label: "Yes - add maintenance rules (recommended)",
                  value: "yes",
                },
                {
                  label: "No - keep MCP setup only",
                  value: "no",
                },
              ]}
              onChange={(value) => {
                if (value === "yes") {
                  setMaintenanceRequested(true);
                  setStep("installingRules");
                  return;
                }

                setMaintenanceRequested(false);
                setStep("done");
              }}
            />
          </Box>
        </>
      )}

      {step === "installingRules" && (
        <Box marginTop={1} marginLeft={2}>
          <Spinner label="Installing maintenance rules..." />
        </Box>
      )}

      {step === "done" && (
        <>
          <ResultsView
            results={results}
            embedded={!!onComplete}
            maintenanceRequested={maintenanceRequested}
          />
          {onComplete && (
            <ContinuePrompt onContinue={() => onComplete(results)} />
          )}
        </>
      )}
    </Box>
  );
}

function ResultsView({
  results,
  embedded,
  maintenanceRequested,
}: {
  results: ClientInstallResult[];
  embedded?: boolean;
  maintenanceRequested?: boolean;
}): React.ReactNode {
  if (results.length === 0) {
    return (
      <>
        <SectionTitle>No clients configured</SectionTitle>
        <Box marginLeft={2}>
          <Text color={colors.muted}>No clients were selected for configuration.</Text>
        </Box>
        {!embedded && (
          <NextStep>{"Run agent-lint init again to set up MCP config."}</NextStep>
        )}
      </>
    );
  }

  const created = results.filter(
    (r) => r.configResult.status === "created" ||
      r.configResult.status === "merged" ||
      r.configResult.status === "cli-success",
  );
  const skipped = results.filter((r) => r.configResult.status === "exists");
  const errors = results.filter(
    (r) => r.configResult.status === "error" || r.configResult.status === "no-scope");
  const ruleCreated = results.filter(
    (r) => r.maintenanceResult?.status === "created" ||
      r.maintenanceResult?.status === "updated" ||
      r.maintenanceResult?.status === "appended");
  const ruleExisting = results.filter((r) => r.maintenanceResult?.status === "exists");
  const ruleSkipped = results.filter((r) => r.maintenanceResult?.status === "skipped");
  const ruleErrors = results.filter((r) => r.maintenanceResult?.status === "error");

  return (
    <>
      {created.length > 0 && (
        <>
          <SectionTitle>Configured</SectionTitle>
          {created.map((r, i) => (
            <SuccessItem key={i}>
              {r.configResult.status === "cli-success"
                ? `${r.client.name} (${r.scope}) via CLI`
                : `${formatPath(r.configResult)} (${r.client.name}, ${r.scope})`}
            </SuccessItem>
          ))}
        </>
      )}

      {skipped.length > 0 && (
        <>
          <SectionTitle>Already configured</SectionTitle>
          {skipped.map((r, i) => (
            <SkipItem key={i}>
              {`${formatPath(r.configResult)} (${r.client.name}) - already exists`}
            </SkipItem>
          ))}
        </>
      )}

      {errors.length > 0 && (
        <>
          <SectionTitle>Errors</SectionTitle>
          {errors.map((r, i) => (
            <ErrorItem key={i}>
              {`${r.client.name}: ${formatError(r.configResult)}`}
            </ErrorItem>
          ))}
        </>
      )}

      {ruleCreated.length > 0 && (
        <>
          <SectionTitle>Maintenance rules installed</SectionTitle>
          {ruleCreated.map((r, i) => (
            <SuccessItem key={i}>
              {`${formatMaintenance(r.maintenanceResult)} (${r.client.name})`}
            </SuccessItem>
          ))}
        </>
      )}

      {ruleExisting.length > 0 && (
        <>
          <SectionTitle>Maintenance rules already configured</SectionTitle>
          {ruleExisting.map((r, i) => (
            <SkipItem key={i}>
              {`${formatMaintenance(r.maintenanceResult)} (${r.client.name})`}
            </SkipItem>
          ))}
        </>
      )}

      {ruleSkipped.length > 0 && (
        <>
          <SectionTitle>Maintenance rules skipped</SectionTitle>
          {ruleSkipped.map((r, i) => (
            <SkipItem key={i}>
              {`${r.client.name}: ${formatMaintenance(r.maintenanceResult)}`}
            </SkipItem>
          ))}
        </>
      )}

      {ruleErrors.length > 0 && (
        <>
          <SectionTitle>Maintenance rule errors</SectionTitle>
          {ruleErrors.map((r, i) => (
            <ErrorItem key={i}>
              {`${r.client.name}: ${formatMaintenance(r.maintenanceResult)}`}
            </ErrorItem>
          ))}
        </>
      )}

      {created.length === 0 && skipped.length > 0 && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.muted}>All selected clients already have MCP config.</Text>
        </Box>
      )}

      {!maintenanceRequested && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.muted}>
            Maintenance rules were not installed. Re-run `agent-lint init --with-rules` if you want ongoing context maintenance.
          </Text>
        </Box>
      )}

      {created.length > 0 && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.success} bold>{"+ "}</Text>
          <Text>MCP config is ready. Now let your agent lint your context files.</Text>
        </Box>
      )}

      {!embedded && (
        <NextStep>
          {`Run ${"`"}agent-lint doctor${"`"} to scan your workspace.`}
        </NextStep>
      )}
    </>
  );
}

export function runInitCommand(options: {
  yes?: boolean;
  all?: boolean;
  withRules?: boolean;
  stdout?: boolean;
}): void {
  if (options.stdout) {
    runStdoutInit(options);
    return;
  }

  render(<InitWizard options={options} showBanner={true} />);
}
