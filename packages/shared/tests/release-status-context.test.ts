import { describe, expect, it } from "vitest";
import { getReleaseStatusSkipReason } from "../../../scripts/lib/release-status-context.mjs";

describe("getReleaseStatusSkipReason", () => {
  it("skips release merge request pipelines", () => {
    const reason = getReleaseStatusSkipReason({
      CI_PIPELINE_SOURCE: "merge_request_event",
      CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "release/next",
    });

    expect(reason).toBe("Release merge request detected. Skipping pending changeset status.");
  });

  it("does not skip normal merge requests", () => {
    const reason = getReleaseStatusSkipReason({
      CI_PIPELINE_SOURCE: "merge_request_event",
      CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feature/fix-doctor",
    });

    expect(reason).toBeNull();
  });

  it("does not skip main branch pipelines", () => {
    const reason = getReleaseStatusSkipReason({
      CI_PIPELINE_SOURCE: "push",
      CI_COMMIT_BRANCH: "main",
    });

    expect(reason).toBeNull();
  });
});
