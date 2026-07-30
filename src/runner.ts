// Generic execution harness shared by evaluate(): bounded concurrency, a
// per-attempt timeout, and a retry policy for transport/communication
// failures. Retries (communication failures) and repetitions (running the
// same case multiple times to measure non-determinism, driven by
// evaluate()'s `samples` option) are deliberately kept as separate concepts
// -- this module only ever knows about retries; evaluate.ts is the one that
// loops over sample indices.
//
// Non-cooperative abort: `ctx.signal` is advisory, the same as everywhere
// else AbortSignal is used in the platform. If a Judge ignores it, the
// underlying call keeps running after we've already given up on it and
// recorded a timeout failure -- see the Judge interface's doc comment and
// docs/threat-model.md. `getLeakedInFlightCount()` below is a best-effort
// way to observe this happening (it does NOT make the runner actually wait
// for or cancel anything; it only counts calls that outlived their timeout).

export interface RetryTimeoutOptions {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly timeoutMs?: number;
}

export type AttemptOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly attempts: number; readonly latencyMs: number }
  | { readonly ok: false; readonly error: string; readonly attempts: number; readonly latencyMs: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let leakedInFlight = 0;

/**
 * Number of judge calls that timed out (we gave up and reported a failure)
 * but have not yet actually settled -- i.e. calls that ignored `ctx.signal`
 * and are still running somewhere. Returns to 0 once they eventually
 * resolve/reject. Best-effort observability, not a cancellation mechanism.
 */
export function getLeakedInFlightCount(): number {
  return leakedInFlight;
}

export async function runWithRetryAndTimeout<T>(
  fn: (ctx: { signal?: AbortSignal }) => Promise<T> | T,
  options: RetryTimeoutOptions,
): Promise<AttemptOutcome<T>> {
  const start = Date.now();
  let lastError = "no attempts were made";
  const maxAttempts = Math.max(1, options.maxAttempts);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = options.timeoutMs !== undefined ? new AbortController() : undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const invocation = Promise.resolve().then(() => fn({ signal: controller?.signal }));

      // Tracks the underlying call independently of the race below, purely so a
      // non-cooperative judge's eventual settlement can be observed/counted.
      invocation.then(
        () => {
          if (timedOut) leakedInFlight = Math.max(0, leakedInFlight - 1);
        },
        () => {
          if (timedOut) leakedInFlight = Math.max(0, leakedInFlight - 1);
        },
      );

      if (options.timeoutMs !== undefined && controller) {
        const value = await new Promise<T>((resolve, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            leakedInFlight += 1;
            controller.abort();
            console.warn(
              `[acyclic-eval] a judge call timed out after ${options.timeoutMs}ms but did not honor ` +
                `ctx.signal; it will keep running in the background and its result will be discarded. ` +
                `Effective concurrency can exceed the configured limit until it settles -- see ` +
                `docs/threat-model.md's "non-cooperative abort" section.`,
            );
            reject(new Error(`timed out after ${options.timeoutMs}ms`));
          }, options.timeoutMs);
          invocation.then(resolve, reject);
        });
        return { ok: true, value, attempts: attempt, latencyMs: Date.now() - start };
      }
      const value = await invocation;
      return { ok: true, value, attempts: attempt, latencyMs: Date.now() - start };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxAttempts && options.backoffMs > 0) {
        await sleep(options.backoffMs);
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { ok: false, error: lastError, attempts: maxAttempts, latencyMs: Date.now() - start };
}

/** Runs `worker` over `items` with at most `concurrency` in flight at once. Order of completion is not guaranteed. */
export async function runPool<TItem>(
  items: readonly TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<void>,
): Promise<void> {
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  let nextIndex = 0;

  async function lane(): Promise<void> {
    for (;;) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= items.length) return;
      await worker(items[idx]!, idx);
    }
  }

  await Promise.all(Array.from({ length: n }, () => lane()));
}
