import {
  buildPolicySnapshot,
  clientMetricIds,
  combineClientAndGuardrailScores,
  computeClientWeightedScore,
  getArtifactScoringPolicy,
  normalizeScore,
} from "@agent-lint/shared";

describe("scoring conventions", () => {
  it("normalizes score bounds and midpoint", () => {
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(100)).toBe(100);
    expect(normalizeScore(50)).toBe(50);
  });

  it("returns a valid scoring policy for each artifact type", () => {
    const artifactTypes = ["agents", "skills", "rules", "workflows", "plans"] as const;

    for (const artifactType of artifactTypes) {
      const policy = getArtifactScoringPolicy(artifactType);
      const totalWeight = policy.metricWeights.reduce((sum, item) => sum + item.weightPercent, 0);

      expect(policy.artifactType).toBe(artifactType);
      expect(policy.clientWeightPercent).toBe(90);
      expect(policy.guardrailWeightPercent).toBe(10);
      expect(policy.metricWeights).toHaveLength(clientMetricIds.length);
      expect(totalWeight).toBe(100);
    }
  });

  it("computes client weighted score with metric weights", () => {
    const policy = getArtifactScoringPolicy("agents");
    const metricScores = Object.fromEntries(clientMetricIds.map((metricId) => [metricId, 50]));

    expect(computeClientWeightedScore(policy, metricScores)).toBe(50);
  });

  it("combines client and guardrail scores with policy weights", () => {
    const policy = getArtifactScoringPolicy("skills");

    const combined = combineClientAndGuardrailScores({
      policy,
      clientWeightedScore: 80,
      guardrailScore: 100,
    });

    expect(combined).toBe(82);
  });

  it("builds a policy snapshot with formula and metadata", () => {
    const snapshot = buildPolicySnapshot("rules");

    expect(snapshot.version).toBe("client-led-v1");
    expect(snapshot.artifactType).toBe("rules");
    expect(snapshot.metricWeights).toHaveLength(clientMetricIds.length);
    expect(snapshot.formula).toContain("clientWeighted*90%");
    expect(snapshot.formula).toContain("serverGuardrail*10%");
  });
});
