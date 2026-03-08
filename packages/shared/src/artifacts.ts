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
