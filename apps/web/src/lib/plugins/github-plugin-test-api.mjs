import { spyOn } from "bun:test";
import { api } from "../api.ts";

const GITHUB_API_METHODS = [
  "getGithubPluginLatestManifest",
  "getGithubPluginRepositoryManifest",
  "getGithubPluginRelease",
  "downloadGithubPluginAssetById",
  "downloadGithubPluginAsset",
];

export const stubUnavailableGithubInstance = () => {
  const spies = GITHUB_API_METHODS.map((method) =>
    spyOn(api, method).mockImplementation(async () => {
      throw new Error("Test instance is unavailable");
    })
  );
  return () => spies.forEach((spy) => spy.mockRestore());
};
