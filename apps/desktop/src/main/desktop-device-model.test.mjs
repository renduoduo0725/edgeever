import { describe, expect, test } from "bun:test";
import { readDesktopDeviceModel } from "./desktop-device-model.mjs";

describe("desktop device model", () => {
  test("prefers the macOS IOKit product name over the board identifier", () => {
    expect(readDesktopDeviceModel({
      execFileSync: (command, args) => {
        expect(command).toBe("ioreg");
        expect(args).toEqual(["-p", "IODeviceTree", "-n", "product", "-rd1"]);
        return `
+-o product  <class IOPlatformDevice>
    {
      "product-description" = <"Mac mini (2024)">
      "product-name" = <"Mac mini (2024)">
      "sub-product-type" = <"Mac16,11">
    }
`;
      },
      platform: "darwin",
    })).toBe("Mac mini (2024)");
  });

  test("falls back to system_profiler machine name when IOKit product-name is missing", () => {
    expect(readDesktopDeviceModel({
      execFileSync: (command, args) => {
        if (command === "ioreg") return `"model" = <"Mac16,7">\n`;
        expect(command).toBe("system_profiler");
        expect(args).toEqual(["SPHardwareDataType", "-json"]);
        return JSON.stringify({
          SPHardwareDataType: [{ machine_model: "Mac16,7", machine_name: "MacBook Pro" }],
        });
      },
      platform: "darwin",
    })).toBe("MacBook Pro");
  });

  test("falls back to the macOS hardware model identifier", () => {
    expect(readDesktopDeviceModel({
      execFileSync: (command, args) => {
        if (command === "ioreg") throw new Error("ioreg unavailable");
        if (command === "system_profiler") throw new Error("system_profiler unavailable");
        expect(command).toBe("sysctl");
        expect(args).toEqual(["-n", "hw.model"]);
        return "Mac16,7\n";
      },
      platform: "darwin",
    })).toBe("Mac16,7");
  });

  test("reads the Windows computer-system model", () => {
    expect(readDesktopDeviceModel({
      execFileSync: (command, args) => {
        expect(command).toBe("powershell.exe");
        expect(args.at(-1)).toContain("Win32_ComputerSystem");
        return "Surface Laptop 5\r\n";
      },
      platform: "win32",
    })).toBe("Surface Laptop 5");
  });

  test("reads the Linux DMI product name", () => {
    expect(readDesktopDeviceModel({
      platform: "linux",
      readFileSync: (path) => {
        expect(path).toBe("/sys/class/dmi/id/product_name");
        return "ThinkPad X1 Carbon Gen 11\n";
      },
    })).toBe("ThinkPad X1 Carbon Gen 11");
  });

  test("returns null when the platform probe fails", () => {
    expect(readDesktopDeviceModel({
      execFileSync: () => {
        throw new Error("sysctl unavailable");
      },
      platform: "darwin",
    })).toBeNull();
  });
});
