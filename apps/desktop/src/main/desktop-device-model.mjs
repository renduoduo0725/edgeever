import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trimModel = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const parseIoregQuotedProperty = (output, key) => {
  const match = String(output ?? "").match(new RegExp(`"${key}"\\s*=\\s*(?:<"([^"]+)">|"([^"]+)")`));
  return trimModel(match?.[1] || match?.[2]);
};

const readDarwinMarketingName = (execFile) => {
  try {
    const productTree = execFile("ioreg", ["-p", "IODeviceTree", "-n", "product", "-rd1"], {
      encoding: "utf8",
      timeout: 2_000,
    });
    const productName = parseIoregQuotedProperty(productTree, "product-name");
    if (productName) return productName;
  } catch {
    // Older Macs may not expose the device-tree product node.
  }
  try {
    const profile = JSON.parse(execFile("system_profiler", ["SPHardwareDataType", "-json"], {
      encoding: "utf8",
      timeout: 5_000,
    }));
    const hardware = Array.isArray(profile?.SPHardwareDataType) ? profile.SPHardwareDataType[0] : null;
    const machineName = trimModel(hardware?.machine_name);
    if (machineName) return machineName;
  } catch {
    // system_profiler is a compatibility fallback for machines without IOKit product-name.
  }
  return null;
};

export const readDesktopDeviceModel = ({
  execFileSync: execFile = execFileSync,
  platform = process.platform,
  readFileSync: readFile = readFileSync,
} = {}) => {
  try {
    if (platform === "darwin") {
      // hw.model is a board identifier (Mac16,11); product-name is the user-facing model.
      return readDarwinMarketingName(execFile)
        || trimModel(execFile("sysctl", ["-n", "hw.model"], { encoding: "utf8", timeout: 2_000 }));
    }
    if (platform === "win32") {
      return trimModel(execFile("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-CimInstance -ClassName Win32_ComputerSystem).Model",
      ], {
        encoding: "utf8",
        timeout: 3_000,
        windowsHide: true,
      }));
    }
    if (platform === "linux") {
      return trimModel(readFile("/sys/class/dmi/id/product_name", "utf8"));
    }
  } catch {
    return null;
  }
  return null;
};
