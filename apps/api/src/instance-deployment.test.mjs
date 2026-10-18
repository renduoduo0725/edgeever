import { expect, test } from "bun:test";
import { resolveDeploymentVersionCreatedAt, resolveImageBuildMetadata, resolveInstanceDeploymentMetadata } from "./instance-deployment";

test("normalizes a runtime-supplied deployment version timestamp and rejects missing or invalid values", () => {
  expect(resolveDeploymentVersionCreatedAt({ deploymentVersionCreatedAt: "2026-10-02T08:00:00+08:00" }))
    .toBe("2026-10-02T00:00:00.000Z");
  expect(resolveDeploymentVersionCreatedAt({})).toBeNull();
  expect(resolveDeploymentVersionCreatedAt({ deploymentVersionCreatedAt: "unknown" })).toBeNull();
});

test("reports image build metadata only from valid build arguments", () => {
  expect(resolveImageBuildMetadata({
    EDGE_EVER_BUILD_CREATED_AT: " 2026-01-02T03:04:05Z ",
    EDGE_EVER_BUILD_TRIGGER: "github_release",
    EDGE_EVER_BUILD_METHOD: "github_actions",
  })).toEqual({
    buildCreatedAt: "2026-01-02T03:04:05.000Z",
    buildProvenance: { trigger: "github_release", method: "github_actions" },
  });
  // A default self-build passes empty build arguments.
  expect(resolveImageBuildMetadata({ EDGE_EVER_BUILD_CREATED_AT: "", EDGE_EVER_BUILD_TRIGGER: "", EDGE_EVER_BUILD_METHOD: "" })).toEqual({
    buildCreatedAt: null,
    buildProvenance: { trigger: "unknown", method: "unknown" },
  });
  expect(resolveImageBuildMetadata({ EDGE_EVER_BUILD_CREATED_AT: "yesterday", EDGE_EVER_BUILD_TRIGGER: "nightly", EDGE_EVER_BUILD_METHOD: "kubernetes" })).toEqual({
    buildCreatedAt: null,
    buildProvenance: { trigger: "unknown", method: "unknown" },
  });
});

test("accepts docker as an explicit deployment method without inferring it", () => {
  expect(resolveInstanceDeploymentMetadata({ EDGE_EVER_DEPLOYMENT_TRIGGER: "manual", EDGE_EVER_DEPLOYMENT_METHOD: "docker" }))
    .toEqual({ trigger: "manual", method: "docker" });
  expect(resolveInstanceDeploymentMetadata({})).toEqual({ trigger: "unknown", method: "unknown" });
});
