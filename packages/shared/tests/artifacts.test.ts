import {
  artifactSubmissionSchema,
  artifactTypeSchema,
  artifactTypeValues,
  contextDocumentSchema,
} from "@agent-lint/shared";

describe("artifacts", () => {
  it("exposes expected artifact type values", () => {
    const expected = ["agents", "skills", "rules", "workflows", "plans"];

    expect([...artifactTypeValues]).toHaveLength(expected.length);
    expect([...artifactTypeValues].slice().sort()).toEqual(expected.slice().sort());
  });

  it("validates artifact type schema", () => {
    expect(artifactTypeSchema.parse("agents")).toBe("agents");
    expect(artifactTypeSchema.safeParse("invalid-type").success).toBe(false);
  });

  it("validates context document schema", () => {
    const valid = {
      label: "Architecture",
      content: "System design details",
      path: "docs/architecture.md",
      type: "plans",
      priority: 3,
    } as const;

    expect(contextDocumentSchema.parse(valid)).toEqual(valid);
    expect(contextDocumentSchema.safeParse({ label: "", content: "x" }).success).toBe(false);
  });

  it("validates artifact submission schema", () => {
    const valid = {
      type: "skills",
      content: "# Skill",
      contextDocuments: [{ label: "Rules", content: "Do X", type: "rules" }],
      userId: "user-123",
    } as const;

    const parsed = artifactSubmissionSchema.parse(valid);
    expect(parsed.type).toBe("skills");
    expect(parsed.contextDocuments).toHaveLength(1);

    expect(artifactSubmissionSchema.safeParse({ type: "skills", content: "" }).success).toBe(false);
  });
});
