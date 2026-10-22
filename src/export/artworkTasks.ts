type Task = { pending: boolean; done: Promise<void>; error?: Error };

/** Prior asset operations finish before the export snapshot is captured. The
 * latest operation owns each asset slot; stale completions cannot overwrite it.
 * Failures stay actionable until that slot is replaced or explicitly cleared. */
export class ArtworkTasks {
  private tasks = new Map<string, Task>();
  revision = 0;
  constructor(private onError: (message: string) => void) {}
  clear(key: string) { if (this.tasks.delete(key)) this.revision++; }
  run<T>(key: string, label: string, prepare: () => Promise<T>, apply: (value: T) => void) {
    const task: Task = { pending: true, done: Promise.resolve() };
    this.tasks.set(key, task); this.revision++;
    task.done = Promise.resolve().then(prepare).then(value => {
      if (this.tasks.get(key) === task) apply(value);
    }).catch(error => {
      if (this.tasks.get(key) !== task) return;
      task.error = new Error(`${label}: ${error instanceof Error ? error.message : 'could not be prepared'}. Replace it and try again.`);
      this.onError(task.error.message);
    }).finally(() => { task.pending = false; });
    return task.done;
  }
  async settle(required?: readonly string[]) {
    for (;;) {
      const pending = [...this.tasks.values()].filter(task => task.pending);
      if (pending.length) { await Promise.all(pending.map(task => task.done)); continue; }
      const failure = [...this.tasks.entries()].find(([key, task]) => task.error && (!required || required.includes(key)))?.[1];
      if (failure?.error) throw failure.error;
      return;
    }
  }
}

export function readArtworkFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('file could not be read'));
    reader.onerror = reader.onabort = () => reject(new Error('file could not be read'));
    reader.readAsDataURL(file);
  });
}

export async function decodeArtworkImage(source: string) {
  const image = new Image(); image.src = source;
  try { await image.decode(); } catch { throw new Error('image could not be decoded'); }
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('image is empty');
  return image;
}
