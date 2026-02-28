import { z } from "zod";

export const artifactTypeValues = [
  "skills",
  "agents",
  "rules",
  "workflows",
  "plans",
] as const;

export const artifactTypeSchema = z.enum(artifactTypeValues);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export type BaseArtifact = {
  type: ArtifactType;
  title?: string;
  content: string;
};

export type SkillArtifact = BaseArtifact & {
  type: "skills";
  toolRefs: string[];
};

export type AgentArtifact = BaseArtifact & {
  type: "agents";
  repoScope: "repo" | "workspace";
};

export type RuleArtifact = BaseArtifact & {
  type: "rules";
  ruleLevel: "global" | "workspace";
};

export type WorkflowArtifact = BaseArtifact & {
  type: "workflows";
  commandCount: number;
};

export type PlanArtifact = BaseArtifact & {
  type: "plans";
  phaseCount: number;
};

export type ArtifactPayload =
  | SkillArtifact
  | AgentArtifact
  | RuleArtifact
  | WorkflowArtifact
  | PlanArtifact;

export const contextDocumentSchema = z.object({
  label: z.string().min(1).max(120),
  content: z.string().min(1).max(200_000),
  path: z.string().min(1).max(512).optional(),
  type: artifactTypeSchema.optional(),
  priority: z.number().int().min(0).max(10).optional(),
});

export type ContextDocumentInput = z.infer<typeof contextDocumentSchema>;

export const artifactSubmissionSchema = z.object({
  type: artifactTypeSchema,
  content: z.string().min(1).max(1_000_000),
  contextDocuments: z.array(contextDocumentSchema).max(20).optional(),
  userId: z.string().min(1).max(128).optional(),
});
