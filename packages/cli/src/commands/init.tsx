import React, { useEffect, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import { Spinner, Select } from "@inkjs/ui";
import {
  Banner,
  ContinuePrompt,
  SectionTitle,
  SuccessItem,
  SkipItem,
  ErrorItem,
  Hint,
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

interface ClientPickerOption {
  client: McpClient;
  value: ClientId;
  detected: boolean;
  globalOnly: boolean;
}

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
    result.status === "updated" ||
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
      process.stdout.write(`[created] ${result.configPath} (${client.name})\n`);
      break;
    case "updated":
      process.stdout.write(`[updated] ${result.configPath} (${client.name})\n`);
      break;
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

export function getCommonScopes(clients: McpClient[]): Scope[] {
  if (clients.length === 0) {
    return [];
  }

  const orderedScopes: Scope[] = ["workspace", "global"];
  return orderedScopes.filter((scope) =>
    clients.every((client) => client.scopes[scope]));
}

function getScopeChoices(clients: McpClient[]): Scope[] {
  if (clients.length === 0) {
    return [];
  }

  const orderedScopes: Scope[] = ["workspace", "global"];
  return orderedScopes.filter((scope) =>
    clients.some((client) => client.scopes[scope]));
}

export function getClientPickerOptions(detected: DetectedClient[]): ClientPickerOption[] {
  const detectedIds = new Set(detected.map((entry) => entry.client.id));

  return [...CLIENT_REGISTRY]
    .sort((left, right) => {
      const leftDetected = detectedIds.has(left.id);
      const rightDetected = detectedIds.has(right.id);
      if (leftDetected === rightDetected) {
        return 0;
      }
      return leftDetected ? -1 : 1;
    })
    .map((client) => ({
      client,
      value: client.id,
      detected: detectedIds.has(client.id),
      globalOnly: !client.scopes.workspace && !!client.scopes.global,
    }));
}

function ClientPicker({
  options,
  defaultValue,
  onSubmit,
}: {
  options: ClientPickerOption[];
  defaultValue: ClientId[];
  onSubmit: (values: ClientId[]) => void;
}): React.ReactNode {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selected, setSelected] = useState<ClientId[]>(defaultValue);

  useInput((input, key) => {
    if (key.downArrow) {
      setFocusedIndex((current) => Math.min(current + 1, options.length - 1));
      return;
    }

    if (key.upArrow) {
      setFocusedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (input === " ") {
      const focused = options[focusedIndex];
      if (!focused) {
        return;
      }

      setSelected((current) =>
        current.includes(focused.value)
          ? current.filter((value) => value !== focused.value)
          : [...current, focused.value]
      );
      return;
    }

    if (key.return) {
      const focused = options[focusedIndex];
      if (!focused) {
        onSubmit(selected);
        return;
      }

      if (selected.length === 0) {
        onSubmit([focused.value]);
        return;
      }

      onSubmit(selected);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} marginLeft={1}>
        <Text color={colors.tertiary} bold>
          {selected.length} client{selected.length !== 1 ? "s" : ""} selected
        </Text>
      </Box>
      {options.map((option, index) => {
        const isFocused = index === focusedIndex;
        const isSelected = selected.includes(option.value);
        const prefix = isFocused ? ">" : " ";
        const checkbox = isSelected ? "[x]" : "[ ]";

        return (
          <Box key={option.value} marginLeft={1} gap={1}>
            <Text color={isFocused ? colors.accent : colors.dim}>{prefix}</Text>
            <Text color={isSelected ? colors.success : colors.muted}>{checkbox}</Text>
            <Text color={isFocused ? colors.tertiary : undefined}>
              {option.client.name}
            </Text>
            {option.detected && (
              <Text color={colors.secondary}>
                {"(detected)"}
              </Text>
            )}
            {option.globalOnly && (
              <Text color={colors.warning}>
                {"(global only)"}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function buildNoCommonScopeResults(selectedClientIds: ClientId[]): ClientInstallResult[] {
  return CLIENT_REGISTRY
    .filter((client) => selectedClientIds.includes(client.id))
    .map((client) => ({
      client,
      scope: getAvailableScopes(client)[0] ?? "global",
      configResult: {
        status: "error" as const,
        message: "Selected clients do not share a common config scope.",
      },
    }));
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
        const allClientIds = CLIENT_REGISTRY.map((client) => client.id);
        const scopeChoices = getScopeChoices(CLIENT_REGISTRY);
        setSelectedClientIds(allClientIds);

        if (scopeChoices.length === 1) {
          setSelectedScope(scopeChoices[0]);
          setStep("installing");
          return;
        }

        setStep("selectScope");
        return;
      }

      setStep("selectClients");
    });
    return () => clearImmediate(id);
  }, [cwd, options.all]);

  useEffect(() => {
    if (step !== "installing" || !selectedScope) {
      return;
    }

    const id = setImmediate(() => {
      const selectedClients = CLIENT_REGISTRY.filter((client) => selectedClientIds.includes(client.id));
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
                status: "skipped" as const,
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

  const defaultSelected = getDefaultSelectedClientIds(detected, cwd);
  const clientOptions = getClientPickerOptions(detected);
  const selectedClients = CLIENT_REGISTRY.filter((client) => selectedClientIds.includes(client.id));
  const scopeChoices = getScopeChoices(selectedClients);
  const scopeOptions = scopeChoices.map((scope) => {
    const supportedCount = selectedClients.filter((client) => client.scopes[scope]).length;
    return {
      label: scope === "workspace"
        ? `Workspace - project-local config (${supportedCount}/${selectedClients.length} clients)`
        : `Global - user-level config (${supportedCount}/${selectedClients.length} clients)`,
      value: scope,
    };
  });

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
          <Hint>{"Enter selects the focused client. Space toggles more clients. Use arrows to move."}</Hint>
          <Box marginLeft={3} marginTop={0}>
            <ClientPicker
              options={clientOptions}
              defaultValue={defaultSelected}
              onSubmit={(values) => {
                const resolvedIds = values as ClientId[];
                const resolvedClients = CLIENT_REGISTRY.filter((client) => resolvedIds.includes(client.id));
                const resolvedScopes = getScopeChoices(resolvedClients);

                setSelectedClientIds(resolvedIds);

                if (resolvedScopes.length === 0) {
                  setResults(buildNoCommonScopeResults(resolvedIds));
                  setStep("done");
                  return;
                }

                if (resolvedScopes.length === 1) {
                  setSelectedScope(resolvedScopes[0]);
                  setStep("installing");
                  return;
                }

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
          <Hint>{"Selected scope labels show how many chosen clients support each scope."}</Hint>
          <Hint>{"Clients that do not support the chosen scope will be reported in the results."}</Hint>
          <Hint>{"Use Enter to confirm the focused scope."}</Hint>
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
          <Spinner label={`Configuring ${selectedScope ?? "selected"} MCP servers...`} />
        </Box>
      )}

      {step === "confirmRules" && (
        <>
          <Box marginTop={1} marginLeft={2}>
            <Text color={colors.success} bold>{"+ "}</Text>
            <Text>MCP setup is complete.</Text>
          </Box>

          <SectionTitle>Install maintenance rules</SectionTitle>
          <Hint>{"Use Enter to confirm the focused option."}</Hint>
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
    (result) => result.configResult.status === "created" ||
      result.configResult.status === "updated" ||
      result.configResult.status === "merged" ||
      result.configResult.status === "cli-success",
  );
  const skipped = results.filter((result) => result.configResult.status === "exists");
  const errors = results.filter(
    (result) => result.configResult.status === "error" || result.configResult.status === "no-scope");
  const ruleCreated = results.filter(
    (result) => result.maintenanceResult?.status === "created" ||
      result.maintenanceResult?.status === "updated" ||
      result.maintenanceResult?.status === "appended",
  );
  const ruleExisting = results.filter((result) => result.maintenanceResult?.status === "exists");
  const ruleSkipped = results.filter((result) => result.maintenanceResult?.status === "skipped");
  const ruleErrors = results.filter((result) => result.maintenanceResult?.status === "error");

  return (
    <>
      {created.length > 0 && (
        <>
          <SectionTitle>Configured</SectionTitle>
          {created.map((result, index) => (
            <SuccessItem key={index}>
              {result.configResult.status === "cli-success"
                ? `${result.client.name} (${result.scope}) via CLI`
                : `${formatPath(result.configResult)} (${result.client.name}, ${result.scope})`}
            </SuccessItem>
          ))}
        </>
      )}

      {skipped.length > 0 && (
        <>
          <SectionTitle>Already configured</SectionTitle>
          {skipped.map((result, index) => (
            <SkipItem key={index}>
              {`${formatPath(result.configResult)} (${result.client.name}) - already exists`}
            </SkipItem>
          ))}
        </>
      )}

      {errors.length > 0 && (
        <>
          <SectionTitle>Errors</SectionTitle>
          {errors.map((result, index) => (
            <ErrorItem key={index}>
              {`${result.client.name}: ${formatError(result.configResult)}`}
            </ErrorItem>
          ))}
        </>
      )}

      {ruleCreated.length > 0 && (
        <>
          <SectionTitle>Maintenance rules installed</SectionTitle>
          {ruleCreated.map((result, index) => (
            <SuccessItem key={index}>
              {`${formatMaintenance(result.maintenanceResult)} (${result.client.name})`}
            </SuccessItem>
          ))}
        </>
      )}

      {ruleExisting.length > 0 && (
        <>
          <SectionTitle>Maintenance rules already configured</SectionTitle>
          {ruleExisting.map((result, index) => (
            <SkipItem key={index}>
              {`${formatMaintenance(result.maintenanceResult)} (${result.client.name})`}
            </SkipItem>
          ))}
        </>
      )}

      {ruleSkipped.length > 0 && (
        <>
          <SectionTitle>Maintenance rules skipped</SectionTitle>
          {ruleSkipped.map((result, index) => (
            <SkipItem key={index}>
              {`${result.client.name}: ${formatMaintenance(result.maintenanceResult)}`}
            </SkipItem>
          ))}
        </>
      )}

      {ruleErrors.length > 0 && (
        <>
          <SectionTitle>Maintenance rule errors</SectionTitle>
          {ruleErrors.map((result, index) => (
            <ErrorItem key={index}>
              {`${result.client.name}: ${formatMaintenance(result.maintenanceResult)}`}
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
          {`Run ${"`"}agent-lint scan${"`"} to scan your workspace.`}
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
