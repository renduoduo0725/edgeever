import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Separate processes ensure each runtime actually starts in the selected system timezone.
test("clip metadata uses the system timezone across offsets, year boundaries and DST", () => {
  const values = ["2023-12-13T13:25:31+08:00", "2024-05-16T17:11:58Z", "2022-06-18T03:47:48.686Z", "2023-12-13T13:25:31+05:30", "2023-12-13T13:25:31-03:30", "2024-01-01T00:15:31.123456+08:00", "2024-03-10T06:59:59Z", "2024-03-10T07:00:00Z"];
  const expected = {
    "Asia/Shanghai": ["2023-12-13 13:25:31", "2024-05-17 01:11:58", "2022-06-18 11:47:48", "2023-12-13 15:55:31", "2023-12-14 00:55:31", "2024-01-01 00:15:31", "2024-03-10 14:59:59", "2024-03-10 15:00:00"],
    "America/New_York": ["2023-12-13 00:25:31", "2024-05-16 13:11:58", "2022-06-17 23:47:48", "2023-12-13 02:55:31", "2023-12-13 11:55:31", "2023-12-31 11:15:31", "2024-03-10 01:59:59", "2024-03-10 03:00:00"],
  };
  // Persist child results so this test does not depend on Bun test subprocess stdout capture.
  const directory = mkdtempSync(join(tmpdir(), "edgeever-clip-time-"));
  try {
    for (const [timezone, result] of Object.entries(expected)) {
      const outputPath = join(directory, "result.json");
      execFileSync(process.execPath, ["-e", `import { writeFileSync } from 'node:fs'; import { clipDateTimeText } from './src/clip-time.ts'; writeFileSync(${JSON.stringify(outputPath)}, JSON.stringify(${JSON.stringify(values)}.map(clipDateTimeText)));`], { cwd: import.meta.dir, env: { ...process.env, TZ: timezone } });
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(result);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
