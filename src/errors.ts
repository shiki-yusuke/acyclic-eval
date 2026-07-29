export class AcyclicEvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcyclicEvalError";
  }
}
