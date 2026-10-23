/** Aborting saves bandwidth; the sequence guard also protects against cached or
 * non-cancellable responses resolving after a newer query or browser Back. */
export class LatestRequest {
  private sequence = 0;
  private controller: AbortController | undefined;
  cancel() {
    this.sequence++;
    this.controller?.abort();
  }
  async run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    apply: (value: T) => void,
    fail: (error: unknown) => void,
  ) {
    this.cancel();
    const sequence = this.sequence;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const result = await work(controller.signal);
      if (sequence === this.sequence && !controller.signal.aborted) apply(result);
    } catch (error) {
      if (sequence === this.sequence && !controller.signal.aborted) fail(error);
    }
  }
}
