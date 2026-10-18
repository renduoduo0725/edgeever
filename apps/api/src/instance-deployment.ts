import {
  resolveDeploymentMethod,
  resolveDeploymentTrigger,
  type DeploymentMetadata,
} from "@edgeever/shared/deployment-metadata";
import type { Bindings } from "./api-context";

declare const __EDGEEVER_INSTANCE_DEPLOYMENT_TRIGGER__: string;
declare const __EDGEEVER_INSTANCE_DEPLOYMENT_METHOD__: string;

const bundledTrigger = typeof __EDGEEVER_INSTANCE_DEPLOYMENT_TRIGGER__ !== "undefined"
  ? __EDGEEVER_INSTANCE_DEPLOYMENT_TRIGGER__
  : "";
const bundledMethod = typeof __EDGEEVER_INSTANCE_DEPLOYMENT_METHOD__ !== "undefined"
  ? __EDGEEVER_INSTANCE_DEPLOYMENT_METHOD__
  : "";

export const resolveInstanceDeploymentMetadata = (
  environment: Pick<Bindings, "EDGE_EVER_DEPLOYMENT_TRIGGER" | "EDGE_EVER_DEPLOYMENT_METHOD">,
): DeploymentMetadata => ({
  trigger: resolveDeploymentTrigger(environment.EDGE_EVER_DEPLOYMENT_TRIGGER?.trim() || bundledTrigger),
  method: resolveDeploymentMethod(environment.EDGE_EVER_DEPLOYMENT_METHOD?.trim() || bundledMethod),
});

export const resolveDeploymentVersionCreatedAt = (
  environment: Pick<Bindings, "deploymentVersionCreatedAt">,
): string | null => {
  const timestamp = environment.deploymentVersionCreatedAt;
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return new Date(timestamp).toISOString();
};

const normalizeTimestamp = (value: string | undefined): string | null => {
  const timestamp = value?.trim();
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return new Date(timestamp).toISOString();
};

/**
 * How and when the container image was produced. This is separate from the
 * instance deployment metadata: an image can be deployed long after it was
 * built, and by a different mechanism.
 */
export const resolveImageBuildMetadata = (
  environment: Pick<Bindings, "EDGE_EVER_BUILD_CREATED_AT" | "EDGE_EVER_BUILD_TRIGGER" | "EDGE_EVER_BUILD_METHOD">,
): { buildCreatedAt: string | null; buildProvenance: DeploymentMetadata } => ({
  buildCreatedAt: normalizeTimestamp(environment.EDGE_EVER_BUILD_CREATED_AT),
  buildProvenance: {
    trigger: resolveDeploymentTrigger(environment.EDGE_EVER_BUILD_TRIGGER?.trim()),
    method: resolveDeploymentMethod(environment.EDGE_EVER_BUILD_METHOD?.trim()),
  },
});
