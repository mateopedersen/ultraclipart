import type { PixelImage } from './types';
/** One source per worker. Superseded tasks can be terminated rather than queued indefinitely. */
export class Processor {
  private worker?: Worker;
  private id = 0;
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason: Error) => void }
  >();
  private source?: PixelImage;
  public fallback = false;
  async open(source: PixelImage) {
    this.source = source;
    if (typeof Worker !== 'undefined')
      try {
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = ({ data }) => {
          const job = this.pending.get(data.id);
          if (!job) return;
          this.pending.delete(data.id);
          if (data.error) job.reject(new Error(data.error));
          else job.resolve(data.result);
        };
        this.worker.onerror = () => {
          for (const job of this.pending.values())
            job.reject(new Error('Image worker could not run. Retry uses the local CPU fallback.'));
          this.pending.clear();
          this.worker?.terminate();
          this.worker = undefined;
          this.fallback = true;
        };
        await this.run('source', source);
        return;
      } catch {
        this.worker?.terminate();
        this.worker = undefined;
      }
    this.fallback = true;
  }
  async run<T = any>(op: string, payload: any): Promise<T> {
    if (this.worker)
      return new Promise((resolve, reject) => {
        const id = ++this.id;
        this.pending.set(id, { resolve, reject });
        this.worker!.postMessage({ id, op, payload });
      });
    // CPU fallback is lazy and yields before each bounded image operation.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pixels = await import('./pixels'),
      effects = await import('./effects'),
      source = this.source!;
    if (op === 'select') return pixels.selectRegion(source, payload.point, payload.options) as T;
    if (op === 'refine')
      return pixels.refineMask(payload.mask, source, payload.kind, payload.radius) as T;
    if (op === 'render')
      return effects.renderPixels(source, payload.regions || [], payload.effects || []) as T;
    if (op === 'extract') {
      const { extractSelectionPixels } = await import('./extract'),
        { effectBounds } = await import('./padding');
      return extractSelectionPixels(
        effects.renderPixels(source, payload.regions || [], payload.effects || []),
        payload.selection,
        effectBounds({ ...source, effects: payload.effects }),
      ) as T;
    }
    if (op === 'inspect')
      return effects.inspectImage(payload.image || source, payload.widthInches) as T;
    if (op === 'cmyk') {
      const { cmykStreams } = await import('./cmyk');
      return cmykStreams(payload.image, payload.lut) as T;
    }
    if (op === 'trace') {
      const { traceLineArt } = await import('./trace');
      return traceLineArt(payload.image, payload.threshold) as T;
    }
    if (op === 'palette')
      return effects.palette(
        source,
        payload.mask ? pixels.decodeMask(payload.mask) : undefined,
      ) as T;
    throw new Error('Unsupported image operation.');
  }
  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
    for (const job of this.pending.values()) job.reject(new Error('Image operation cancelled.'));
    this.pending.clear();
  }
}
