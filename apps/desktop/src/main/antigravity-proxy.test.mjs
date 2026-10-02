import { describe, expect, test } from "bun:test";
import { antigravityMacProxyEnv, withAntigravityMacProxy } from "./antigravity-proxy.mjs";

const systemProxy = `<dictionary> {
  HTTPEnable : 1
  HTTPProxy : 127.0.0.1
  HTTPPort : 10808
  HTTPSEnable : 1
  HTTPSProxy : 127.0.0.1
  HTTPSPort : 10809
  SOCKSEnable : 1
  SOCKSProxy : 127.0.0.1
  SOCKSPort : 10808
}`;

describe("Antigravity macOS proxy", () => {
  test("uses the system HTTP endpoints when SOCKS would break the bundled ACP server", () => {
    const options = { platform: "darwin", env: {}, readProxy: () => systemProxy };
    expect(antigravityMacProxyEnv(options)).toEqual({
      HTTP_PROXY: "http://127.0.0.1:10808",
      HTTPS_PROXY: "http://127.0.0.1:10809",
    });
    expect(withAntigravityMacProxy({ command: "/tmp/agy_acp_server.par", args: [] }, options).env).toEqual(antigravityMacProxyEnv(options));
  });

  test("preserves explicit proxy choices and other platforms", () => {
    const readProxy = () => systemProxy;
    expect(antigravityMacProxyEnv({ platform: "darwin", env: { https_proxy: "socks5://localhost:9999" }, readProxy })).toBeNull();
    expect(antigravityMacProxyEnv({ platform: "linux", env: {}, readProxy })).toBeNull();
    expect(antigravityMacProxyEnv({ platform: "darwin", env: {}, readProxy: () => systemProxy.replace("SOCKSEnable : 1", "SOCKSEnable : 0") })).toBeNull();
  });

  test("does not use a SOCKS-only or malformed HTTP proxy", () => {
    expect(antigravityMacProxyEnv({ platform: "darwin", env: {}, readProxy: () => "SOCKSEnable : 1\nSOCKSProxy : localhost\nSOCKSPort : 1080" })).toBeNull();
    expect(antigravityMacProxyEnv({ platform: "darwin", env: {}, readProxy: () => systemProxy.replaceAll("127.0.0.1", "user@untrusted.example") })).toBeNull();
  });
});
