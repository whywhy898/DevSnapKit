/** JSON-value equality for immutable snapshots. Shared images are compared once
 * as strings, rather than reserializing megabytes of base64 on every input.
 * Optional object values are omitted and array holes/nonfinite numbers are null,
 * matching the prior JSON serialization; property order is semantically irrelevant.
 */
export function equalValues(a: unknown, b: unknown, arrayEntry = false): boolean {
  const omitted = (value: unknown) => value === undefined || typeof value === 'function' || typeof value === 'symbol';
  if ((typeof a === 'number' && !Number.isFinite(a)) || (arrayEntry && omitted(a))) a = null;
  if ((typeof b === 'number' && !Number.isFinite(b)) || (arrayEntry && omitted(b))) b = null;
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && Array.from({ length: a.length }, (_, i) => equalValues(a[i], b[i], true)).every(Boolean);
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter(key => !omitted(left[key]));
  const otherKeys = Object.keys(right).filter(key => !omitted(right[key]));
  return keys.length === otherKeys.length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && !omitted(right[key]) && equalValues(left[key], right[key]));
}

/** Value history for the complete editor; refs and selection never belong here. */
export class EditorHistory<T> {
  private entries: T[];
  private cursor = 0;
  private commitIds = [0];
  private nextCommitId = 1;
  private baseline: T | undefined;
  private transactionValue: T | undefined;
  constructor(initial: T, private limit = 50) { this.entries = [initial]; }
  get current(): T { return this.transactionValue ?? this.entries[this.cursor]; }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length - 1; }
  get count() { return this.entries.length; }
  get index() { return this.cursor; }
  get currentCommitId() { return this.commitIds[this.cursor]; }
  get previous(): T | undefined { return this.entries[this.cursor - 1]; }
  undoCommit(id: number, snapshot: T): T | null {
    if (this.inTransaction || id !== this.currentCommitId || !this.canUndo || !this.equal(this.current, snapshot)) return null;
    this.cursor--; return this.current;
  }
  get inTransaction() { return this.baseline !== undefined; }
  equal(a: T, b: T) { return equalValues(a, b); }
  flush(snapshot: T) {
    if (this.inTransaction || this.equal(this.entries[this.cursor], snapshot)) return;
    this.entries = [...this.entries.slice(0, this.cursor + 1), snapshot].slice(-this.limit);
    this.commitIds = [...this.commitIds.slice(0, this.cursor + 1), this.nextCommitId++].slice(-this.limit);
    this.cursor = this.entries.length - 1;
  }
  beginTransaction(snapshot: T) {
    if (this.inTransaction) throw new Error('Finish the active editor transaction first.');
    this.flush(snapshot); this.baseline = snapshot; this.transactionValue = snapshot;
  }
  updateTransaction(snapshot: T) {
    if (!this.inTransaction) throw new Error('No active editor transaction.');
    this.transactionValue = snapshot;
  }
  commitTransaction(snapshot: T) {
    if (!this.inTransaction) { this.flush(snapshot); return; }
    this.baseline = undefined; this.transactionValue = undefined; this.flush(snapshot);
  }
  cancelTransaction(): T {
    const target = this.baseline ?? this.current;
    this.baseline = undefined; this.transactionValue = undefined;
    return target;
  }
  undo(snapshot: T): T {
    if (this.inTransaction) this.commitTransaction(snapshot); else this.flush(snapshot);
    if (this.canUndo) this.cursor--;
    return this.current;
  }
  redo(): T { if (this.canRedo && !this.inTransaction) this.cursor++; return this.current; }
}
