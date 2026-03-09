export function getReleaseStatusSkipReason(env = process.env) {
  const isMergeRequestPipeline = env.CI_PIPELINE_SOURCE === "merge_request_event";
  const isReleaseMergeRequest = env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME === "release/next";

  if (isMergeRequestPipeline && isReleaseMergeRequest) {
    return "Release merge request detected. Skipping pending changeset status.";
  }

  return null;
}
