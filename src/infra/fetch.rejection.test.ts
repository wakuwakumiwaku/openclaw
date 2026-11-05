import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("does not leak an unhandled rejection after a handled foreign-signal fetch failure", () => {
  // Isolate the process-level event from Vitest's own rejection listener.
  // The fetch is synthetic: no socket or external request is created.
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      `
    import assert from "node:assert/strict";
    import { wrapFetchWithAbortSignal } from "./src/infra/fetch.ts";
    const unhandled = [];
    process.on("unhandledRejection", error => unhandled.push(error));
    const failure = new Error("synthetic fetch failure");
    let listeners = 0;
    const signal = {
      aborted: false,
      addEventListener() { listeners++; },
      removeEventListener() { listeners--; },
    };
    const wrapped = wrapFetchWithAbortSignal(async () => { throw failure; });
    await assert.rejects(wrapped("https://example.invalid/", { signal }), error => error === failure);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(listeners, 0, "abort relay must be removed after failure");
    assert.deepEqual(unhandled, [], "handled fetch must not create a detached rejected promise");
  `,
    ],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: process.env,
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
});
