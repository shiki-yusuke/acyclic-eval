// Vendor-neutral adapter sketch. It intentionally imports no SDK and reads no
// environment variables: the application owns credentials, model selection,
// retries, and any network policy. Keep this adapter separate from mutation
// operators so generation cannot call the judge it evaluates.

import type { Judge, JudgeContext } from "../../src/types.js";

export type Verdict = "proven" | "contradicted" | "unknown";

export interface LlmInvoker {
  /** A stable, non-secret identifier recorded with observations. */
  readonly id: string;
  readonly version?: string;
  /** Implement with the provider or local model chosen by the application. */
  invoke(prompt: string, context: JudgeContext): Promise<string>;
}

export function createLlmJudge(invoker: LlmInvoker): Judge<{ readonly prompt: string }, Verdict> {
  return {
    id: invoker.id,
    version: invoker.version,
    async evaluate(input, context) {
      const response = (await invoker.invoke(input.prompt, context)).trim().toLowerCase();
      if (response === "proven" || response === "contradicted" || response === "unknown") {
        return response;
      }
      throw new Error("LlmInvoker must normalize its response to proven, contradicted, or unknown.");
    },
  };
}
