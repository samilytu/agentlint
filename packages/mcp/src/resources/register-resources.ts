import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  artifactTypeValues,
  type ArtifactType,
  buildArtifactPathHintsMarkdown,
  buildArtifactSpecMarkdown,
  buildAssessmentSchemaMarkdown,
  buildImprovementPlaybookMarkdown,
  buildScoringPolicyMarkdown,
} from "@agent-lint/shared";
import { getPromptPack, judgeSystemPrompts } from "@agent-lint/core";

const QUALITY_METRICS_MD = [
  "# Agent Lint Quality Metrics",
  "",
  "Primary dimensions used by Agent Lint scoring:",
  "- clarity: instructions are unambiguous and easy to follow",
  "- safety: destructive operations are gated and explicit",
  "- tokenEfficiency: content stays concise and operational",
  "- completeness: required sections and constraints are present",
  "",
  "Secondary checklist metrics used during analysis include:",
  "- specificity, scope-control, verifiability, actionability",
  "- injection-resistance, secret-hygiene, platform-fit, maintainability",
  "",
  "Default artifact QA policy:",
  "1) prepare_artifact_fix_context",
  "2) read scoring policy + assessment schema resources",
  "3) client computes weighted scores + evidence and calls submit_client_assessment",
  "4) quality_gate_artifact with candidateContent + clientAssessment",
  "5) validate_export before final delivery",
].join("\n");

function asArtifactType(value: string | string[] | undefined): ArtifactType | null {
  if (!value) {
    return null;
  }

  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) {
    return null;
  }

  return artifactTypeValues.includes(normalized as ArtifactType)
    ? (normalized as ArtifactType)
    : null;
}

function listQualityMetricResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://quality-metrics/${type}`,
    name: `Agent Lint quality metrics (${type})`,
    description: `Quality rubric and scoring conventions for ${type} artifacts.`,
    mimeType: "text/markdown",
  }));
}

function listPromptPackResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://prompt-pack/${type}`,
    name: `Agent Lint prompt pack (${type})`,
    description: `Prompt pack used for ${type} artifact generation and repair.`,
    mimeType: "text/markdown",
  }));
}

function listPromptTemplateResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://prompt-template/${type}`,
    name: `Agent Lint prompt template (${type})`,
    description: `Judge system prompt template used for ${type} analysis.`,
    mimeType: "text/plain",
  }));
}

function listPathHintResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://artifact-path-hints/${type}`,
    name: `Agent Lint artifact path hints (${type})`,
    description: `Discovery patterns and aliases for ${type} files across MCP client ecosystems.`,
    mimeType: "text/markdown",
  }));
}

function listArtifactSpecResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://artifact-spec/${type}`,
    name: `Agent Lint artifact spec (${type})`,
    description: `Required sections, quality checks, and validation loop for ${type}.`,
    mimeType: "text/markdown",
  }));
}

function listScoringPolicyResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://scoring-policy/${type}`,
    name: `Agent Lint scoring policy (${type})`,
    description: `Client-led metric weights and hybrid scoring contract for ${type}.`,
    mimeType: "text/markdown",
  }));
}

function listAssessmentSchemaResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://assessment-schema/${type}`,
    name: `Agent Lint assessment schema (${type})`,
    description: `Required client scoring payload format and evidence rules for ${type}.`,
    mimeType: "text/markdown",
  }));
}

function listImprovementPlaybookResources() {
  return artifactTypeValues.map((type) => ({
    uri: `agentlint://improvement-playbook/${type}`,
    name: `Agent Lint improvement playbook (${type})`,
    description: `Iteration tactics and next-step strategy for improving ${type} artifacts.`,
    mimeType: "text/markdown",
  }));
}

function qualityMetricsForType(type: ArtifactType): string {
  return [
    QUALITY_METRICS_MD,
    "",
    `## Type focus: ${type}`,
    "",
    "When to use:",
    "- Use before finalizing AGENTS/skills/rules/workflows/plans content.",
    "- Use to decide if a patch/fix pass is required.",
  ].join("\n");
}

export function registerAgentLintResources(server: McpServer): void {
  server.registerResource(
    "agentlint-quality-metrics",
    new ResourceTemplate("agentlint://quality-metrics/{type}", {
      list: async () => ({
        resources: listQualityMetricResources(),
      }),
    }),
    {
      title: "Agent Lint Quality Metrics",
      description: "Quality and scoring metrics for each artifact type.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: qualityMetricsForType(type),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-prompt-pack",
    new ResourceTemplate("agentlint://prompt-pack/{type}", {
      list: async () => ({
        resources: listPromptPackResources(),
      }),
    }),
    {
      title: "Agent Lint Prompt Pack",
      description: "Prompt pack text used for artifact creation and fixing.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      const pack = getPromptPack(type);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: [
              `# ${pack.title}`,
              "",
              `Summary: ${pack.summary}`,
              "",
              "## Prompt",
              "",
              pack.prompt,
            ].join("\n"),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-prompt-template",
    new ResourceTemplate("agentlint://prompt-template/{type}", {
      list: async () => ({
        resources: listPromptTemplateResources(),
      }),
    }),
    {
      title: "Agent Lint Prompt Template",
      description: "Judge prompt template used for analysis.",
      mimeType: "text/plain",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: judgeSystemPrompts[type],
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-artifact-path-hints",
    new ResourceTemplate("agentlint://artifact-path-hints/{type}", {
      list: async () => ({
        resources: listPathHintResources(),
      }),
    }),
    {
      title: "Agent Lint Artifact Path Hints",
      description: "Cross-client file path aliases and discovery hints.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: buildArtifactPathHintsMarkdown(type),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-artifact-spec",
    new ResourceTemplate("agentlint://artifact-spec/{type}", {
      list: async () => ({
        resources: listArtifactSpecResources(),
      }),
    }),
    {
      title: "Agent Lint Artifact Spec",
      description: "Structured specification and quality requirements for artifact creation.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: buildArtifactSpecMarkdown(type),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-scoring-policy",
    new ResourceTemplate("agentlint://scoring-policy/{type}", {
      list: async () => ({
        resources: listScoringPolicyResources(),
      }),
    }),
    {
      title: "Agent Lint Scoring Policy",
      description: "Client-led metric weighting and hybrid score formula by artifact type.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: buildScoringPolicyMarkdown(type),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-assessment-schema",
    new ResourceTemplate("agentlint://assessment-schema/{type}", {
      list: async () => ({
        resources: listAssessmentSchemaResources(),
      }),
    }),
    {
      title: "Agent Lint Assessment Schema",
      description: "Schema guidance for submit_client_assessment payloads.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: buildAssessmentSchemaMarkdown(type),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-improvement-playbook",
    new ResourceTemplate("agentlint://improvement-playbook/{type}", {
      list: async () => ({
        resources: listImprovementPlaybookResources(),
      }),
    }),
    {
      title: "Agent Lint Improvement Playbook",
      description: "Iteration guidance for client-driven artifact improvement loops.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: buildImprovementPlaybookMarkdown(type),
          },
        ],
      };
    },
  );
}
