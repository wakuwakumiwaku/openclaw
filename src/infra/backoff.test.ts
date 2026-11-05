import { afterEach, describe, expect, it, vi } from "vitest";
import { computeBackoff } from "./backoff.js";

// Long-running Signal/Telegram reconnect loops can exceed the floating-point exponent range.
describe("computeBackoff", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([0, 0.2])("keeps the delay finite after overflow with jitter %s", (jitter) => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const policy = { initialMs: 1000, maxMs: 10000, factor: 2, jitter };
    expect(computeBackoff(policy, 1025)).toBe(10000);
    expect(computeBackoff(policy, Number.MAX_SAFE_INTEGER)).toBe(10000);
  });

  it("preserves uncapped exponential and jittered delays", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const policy = { initialMs: 1000, maxMs: 10000, factor: 2, jitter: 0.2 };
    expect(computeBackoff(policy, 1)).toBe(1100);
    expect(computeBackoff(policy, 2)).toBe(2200);
    expect(computeBackoff(policy, 5)).toBe(10000);
  });
});
