import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  analyzeShellCommand,
  buildSafeBinsShellCommand,
  buildSafeShellCommand,
} from "../infra/exec-approvals-analysis.js";
import { splitShellArgs } from "./shell-argv.js";

describe("empty quoted shell arguments", () => {
  it.each([
    [`printf '' "" end`, ["printf", "", "", "end"]],
    [`'' command`, ["", "command"]],
    [`printf ""`, ["printf", ""]],
    [`printf a''b ""'' ' '`, ["printf", "ab", "", " "]],
    [`  printf\t""\tend  `, ["printf", "", "end"]],
  ])("preserves argument positions in %s", (command, expected) => {
    expect(splitShellArgs(command)).toEqual(expected);
  });

  it("does not manufacture arguments from whitespace or accept incomplete tokens", () => {
    expect(splitShellArgs(" \t ")).toEqual([]);
    expect(splitShellArgs("printf word")).toEqual(["printf", "word"]);
    expect(splitShellArgs(`printf '' "`)).toBeNull();
    expect(splitShellArgs("printf tail\\")).toBeNull();
  });

  it.skipIf(process.platform === "win32")(
    "retains empty operands in actual safe command execution",
    () => {
      const command = `printf '<%s><%s>\\n' '' tail`;
      const rebuilt = buildSafeShellCommand({ command, platform: process.platform });
      expect(rebuilt.ok).toBe(true);
      expect(rebuilt.command).toBeDefined();
      const output = execFileSync("/bin/sh", ["-c", rebuilt.command!], {
        encoding: "utf8",
        timeout: 2000,
        env: { PATH: "/usr/bin:/bin" },
      });
      expect(output).toBe("<><tail>\n");
    },
  );

  it("retains the same argv through approval analysis and safe-bin rebuilding", () => {
    const command = `printf '%s' '' tail`;
    const analysis = analyzeShellCommand({ command, platform: "linux" });
    expect(analysis.ok).toBe(true);
    expect(analysis.segments[0]?.argv).toEqual(["printf", "%s", "", "tail"]);
    const rebuilt = buildSafeBinsShellCommand({
      command,
      segments: analysis.segments,
      segmentSatisfiedBy: ["safeBins"],
      platform: "linux",
    });
    expect(rebuilt).toEqual({ ok: true, command: "'printf' '%s' '' 'tail'" });
  });
});
