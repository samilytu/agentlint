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

export const artifactSubmissionSchema = z.object({
  type: artifactTypeSchema,
  content: z.string().min(1).max(1_000_000),
  userId: z.string().min(1).max(128).optional(),
});
