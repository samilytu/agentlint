import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  artifactTypeValues,
  type ArtifactType,
  buildArtifactPathHintsMarkdown,
} from "@agent-lint/shared";
import { buildGuidelines, buildTemplateMarkdown } from "@agent-lint/core";

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

function invalidTypeResponse(uri: URL) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "text/plain" as const,
        text: `Invalid artifact type. Expected one of: ${artifactTypeValues.join(", ")}.`,
      },
    ],
  };
}

export function registerAgentLintResources(server: McpServer): void {
  server.registerResource(
    "agentlint-guidelines",
    new ResourceTemplate("agentlint://guidelines/{type}", {
      list: async () => ({
        resources: artifactTypeValues.map((type) => ({
          uri: `agentlint://guidelines/${type}`,
          name: `Agent Lint guidelines (${type})`,
          description: `Comprehensive guidelines for creating or updating ${type} artifacts.`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "Agent Lint Guidelines",
      description:
        "Comprehensive guidelines for creating or updating AI agent context artifacts. Includes mandatory sections, do/don't lists, anti-patterns, quality checklist, and template skeleton.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return invalidTypeResponse(uri);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown" as const,
            text: buildGuidelines(type),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-template",
    new ResourceTemplate("agentlint://template/{type}", {
      list: async () => ({
        resources: artifactTypeValues.map((type) => ({
          uri: `agentlint://template/${type}`,
          name: `Agent Lint template (${type})`,
          description: `Skeleton template for creating a new ${type} artifact.`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "Agent Lint Template",
      description:
        "Skeleton template for creating a new AI agent context artifact. Replace TODO items with project-specific content.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return invalidTypeResponse(uri);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown" as const,
            text: buildTemplateMarkdown(type),
          },
        ],
      };
    },
  );

  server.registerResource(
    "agentlint-path-hints",
    new ResourceTemplate("agentlint://path-hints/{type}", {
      list: async () => ({
        resources: artifactTypeValues.map((type) => ({
          uri: `agentlint://path-hints/${type}`,
          name: `Agent Lint path hints (${type})`,
          description: `File discovery patterns for ${type} artifacts across IDE clients.`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "Agent Lint Path Hints",
      description:
        "File path patterns and discovery hints for finding AI agent context artifacts in different IDE client ecosystems.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = asArtifactType(variables.type);
      if (!type) {
        return invalidTypeResponse(uri);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown" as const,
            text: buildArtifactPathHintsMarkdown(type),
          },
        ],
      };
    },
  );
}
