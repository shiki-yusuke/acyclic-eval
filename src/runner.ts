// Generic execution harness shared by evaluate(): bounded concurrency, a
// per-attempt timeout, and a retry policy for transport/communication
// failures. Retries (communication failures) and repetitions (running the
// same case multiple times to measure non-determinism, driven by
// evaluate()'s `samples` option) are deliberately kept as separate concepts
// -- this module only ever knows about retries; evaluate.ts is the one that
// loops over sample indices.

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
    try {
      const invocation = Promise.resolve().then(() => fn({ signal: controller?.signal }));
      if (options.timeoutMs !== undefined && controller) {
        const value = await new Promise<T>((resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
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
