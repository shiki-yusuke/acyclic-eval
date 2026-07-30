import { describe, expect, it, vi } from "vitest";
import { getLeakedInFlightCount, runPool, runWithRetryAndTimeout } from "../src/runner.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("runPool concurrency cap", () => {
  it("never runs more than `concurrency` workers at once", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let current = 0;
    let max = 0;
    let completed = 0;

    await runPool(items, 3, async () => {
      current += 1;
      max = Math.max(max, current);
      await sleep(5);
      current -= 1;
      completed += 1;
    });

    expect(max).toBeLessThanOrEqual(3);
    expect(completed).toBe(10);
  });

  it("falls back to at least 1 worker even if concurrency is 0 or negative", async () => {
    let ran = 0;
    await runPool([1, 2], 0, async () => {
      ran += 1;
    });
    expect(ran).toBe(2);
  });
});

describe("runWithRetryAndTimeout: timeout and abort", () => {
  it("times out a call that never resolves within timeoutMs and reports it as a failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const outcome = await runWithRetryAndTimeout<never>(() => new Promise<never>(() => {}), {
      maxAttempts: 1,
      backoffMs: 0,
      timeoutMs: 20,
    });
    warnSpy.mockRestore();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/timed out/);
  });

  it("aborts the signal it hands to the callee when the timeout fires", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let sawAbort = false;
    await runWithRetryAndTimeout(
      (ctx) =>
        new Promise((resolve) => {
          ctx.signal?.addEventListener("abort", () => {
            sawAbort = true;
          });
          setTimeout(resolve, 30);
        }),
      { maxAttempts: 1, backoffMs: 0, timeoutMs: 10 },
    );
    expect(sawAbort).toBe(true);
    await sleep(40); // let the background call settle so it doesn't bleed into other tests
    warnSpy.mockRestore();
  });

  it("does not time out a call that completes within timeoutMs", async () => {
    const outcome = await runWithRetryAndTimeout(async () => "ok", { maxAttempts: 1, backoffMs: 0, timeoutMs: 1000 });
    expect(outcome).toMatchObject({ ok: true, value: "ok" });
  });
});

describe("runWithRetryAndTimeout: non-cooperative abort (a judge that ignores ctx.signal)", () => {
  it("logs a warning and counts an in-flight leak when the callee ignores the abort signal, clearing once it settles", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const before = getLeakedInFlightCount();
      const outcome = await runWithRetryAndTimeout(
        () => new Promise((resolve) => setTimeout(() => resolve("late, discarded"), 30)), // never looks at ctx.signal
        { maxAttempts: 1, backoffMs: 0, timeoutMs: 10 },
      );
      expect(outcome.ok).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      expect(String(warnSpy.mock.calls[0]![0])).toMatch(/did not honor/);
      expect(getLeakedInFlightCount()).toBe(before + 1);

      await sleep(40); // let the abandoned invocation actually resolve in the background
      expect(getLeakedInFlightCount()).toBe(before);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not warn or count a leak for a call that finishes before its timeout", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const before = getLeakedInFlightCount();
      const outcome = await runWithRetryAndTimeout(async () => "quick", { maxAttempts: 1, backoffMs: 0, timeoutMs: 1000 });
      expect(outcome).toMatchObject({ ok: true, value: "quick" });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(getLeakedInFlightCount()).toBe(before);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("runWithRetryAndTimeout: retry policy", () => {
  it("retries on failure and records the number of attempts consumed", async () => {
    let calls = 0;
    const outcome = await runWithRetryAndTimeout(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("transient failure");
        return "recovered";
      },
      { maxAttempts: 5, backoffMs: 0 },
    );
    expect(outcome).toMatchObject({ ok: true, value: "recovered", attempts: 3 });
  });

  it("exhausts maxAttempts and reports the final failure", async () => {
    let calls = 0;
    const outcome = await runWithRetryAndTimeout(
      async () => {
        calls += 1;
        throw new Error("always fails");
      },
      { maxAttempts: 3, backoffMs: 0 },
    );
    expect(calls).toBe(3);
    expect(outcome.ok).toBe(false);
    expect(outcome.attempts).toBe(3);
  });

  it("succeeds on the first attempt without retrying", async () => {
    let calls = 0;
    const outcome = await runWithRetryAndTimeout(
      async () => {
        calls += 1;
        return "first-try";
      },
      { maxAttempts: 3, backoffMs: 0 },
    );
    expect(outcome).toMatchObject({ ok: true, value: "first-try", attempts: 1 });
    expect(calls).toBe(1);
  });
});
