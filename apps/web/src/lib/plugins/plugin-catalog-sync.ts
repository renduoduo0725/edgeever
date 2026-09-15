import type { WorkspaceExtension, WorkspaceExtensionUpsertInput } from "@edgeever/shared";
import { api } from "@/lib/api";
import type { ExtensionInstallSource, InstalledExtension } from "@/lib/plugins/plugin-host";

export interface PluginCatalogAdapter {
  list(): Promise<WorkspaceExtension[]>;
  upsert(extensionId: string, input: WorkspaceExtensionUpsertInput): Promise<WorkspaceExtension>;
  remove(extensionId: string): Promise<WorkspaceExtension>;
}

export type LocalCatalogExtension = {
  extensionId: string;
  type: "plugin" | "theme";
  version: string;
  enabled: boolean;
  catalogUpdatedAt: string;
  publisher?: "edgeever";
};

export type CatalogReconcileAction =
  | { type: "uninstall"; extensionId: string }
  | { type: "install"; entry: WorkspaceExtension }
  | { type: "setEnabled"; extensionId: string; enabled: boolean }
  | { type: "awaitTrust"; extensionId: string }
  | { type: "push"; extensionId: string };

export const createPluginCatalogAdapter = (): PluginCatalogAdapter => ({
  list: async () => (await api.listWorkspaceExtensions()).extensions,
  upsert: async (extensionId, input) => (await api.upsertWorkspaceExtension(extensionId, input)).extension,
  remove: async (extensionId) => (await api.deleteWorkspaceExtension(extensionId)).extension,
});

export const toWorkspaceExtensionUpsert = (extension: InstalledExtension): WorkspaceExtensionUpsertInput => ({
  type: extension.manifest.type,
  version: extension.manifest.version,
  enabled: extension.enabled,
  installedAt: extension.installedAt,
  manifestUrl: extension.manifestUrl,
  sourceKind: extension.source.kind,
  verified: extension.source.verified,
  repositoryUrl: extension.source.repositoryUrl ?? null,
  releaseTag: extension.source.releaseTag ?? null,
  publisher: extension.source.publisher ?? null,
});

export const toLocalCatalogExtension = (extension: InstalledExtension): LocalCatalogExtension => ({
  extensionId: extension.manifest.id,
  type: extension.manifest.type,
  version: extension.manifest.version,
  enabled: extension.enabled,
  catalogUpdatedAt: extension.catalogUpdatedAt,
  ...(extension.source.publisher === "edgeever" ? { publisher: "edgeever" } : {}),
});

const isOfficialExtension = (
  extensionId: string,
  type: "plugin" | "theme",
  publisher: "edgeever" | null | undefined,
  officialIds: ReadonlySet<string>,
) => type === "theme" || publisher === "edgeever" || officialIds.has(extensionId);

const enableAction = (
  entry: Pick<WorkspaceExtension, "extensionId" | "type" | "publisher">,
  hasTrustAcknowledgement: boolean,
  officialIds: ReadonlySet<string>,
): CatalogReconcileAction => {
  if (
    entry.type === "plugin"
    && !hasTrustAcknowledgement
    && !isOfficialExtension(entry.extensionId, entry.type, entry.publisher, officialIds)
  ) {
    return { type: "awaitTrust", extensionId: entry.extensionId };
  }
  return { type: "setEnabled", extensionId: entry.extensionId, enabled: true };
};

export const planCatalogReconcile = ({
  local,
  remote,
  hasTrustAcknowledgement,
  officialIds,
}: {
  local: readonly LocalCatalogExtension[];
  remote: readonly WorkspaceExtension[];
  hasTrustAcknowledgement: boolean;
  officialIds: ReadonlySet<string>;
}): CatalogReconcileAction[] => {
  const actions: CatalogReconcileAction[] = [];
  const localById = new Map(local.map((item) => [item.extensionId, item]));
  const remoteById = new Map(remote.map((item) => [item.extensionId, item]));

  for (const remoteEntry of remote) {
    const localEntry = localById.get(remoteEntry.extensionId);
    if (remoteEntry.deletedAt) {
      if (localEntry && localEntry.catalogUpdatedAt > remoteEntry.updatedAt) {
        actions.push({ type: "push", extensionId: localEntry.extensionId });
      } else if (localEntry) {
        actions.push({ type: "uninstall", extensionId: localEntry.extensionId });
      }
      continue;
    }

    if (!localEntry) {
      actions.push({ type: "install", entry: remoteEntry });
      if (remoteEntry.enabled) actions.push(enableAction(remoteEntry, hasTrustAcknowledgement, officialIds));
      continue;
    }

    if (localEntry.catalogUpdatedAt > remoteEntry.updatedAt) {
      actions.push({ type: "push", extensionId: localEntry.extensionId });
      continue;
    }

    if (localEntry.version !== remoteEntry.version) {
      actions.push({ type: "install", entry: remoteEntry });
    }

    const official = isOfficialExtension(
      remoteEntry.extensionId,
      remoteEntry.type,
      remoteEntry.publisher ?? localEntry.publisher ?? null,
      officialIds,
    );
    if (remoteEntry.enabled && !localEntry.enabled) {
      actions.push(enableAction(
        { ...remoteEntry, publisher: official ? "edgeever" : remoteEntry.publisher },
        hasTrustAcknowledgement,
        officialIds,
      ));
    } else if (!remoteEntry.enabled && localEntry.enabled) {
      actions.push({ type: "setEnabled", extensionId: remoteEntry.extensionId, enabled: false });
    }
  }

  for (const localEntry of local) {
    if (!remoteById.has(localEntry.extensionId)) {
      actions.push({ type: "push", extensionId: localEntry.extensionId });
    }
  }

  return actions;
};

export const catalogInstallSource = (entry: WorkspaceExtension): ExtensionInstallSource => ({
  kind: entry.sourceKind,
  verified: entry.verified,
  ...(entry.repositoryUrl ? { repositoryUrl: entry.repositoryUrl } : {}),
  ...(entry.releaseTag ? { releaseTag: entry.releaseTag } : {}),
  ...(entry.publisher === "edgeever" ? { publisher: "edgeever" } : {}),
});
