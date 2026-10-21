/** Value history for the complete editor; refs and selection never belong here. */
export class EditorHistory<T> {
  private entries: T[];
  private cursor = 0;
  private baseline: T | undefined;
  private transactionValue: T | undefined;
  constructor(initial: T, private limit = 50) { this.entries = [initial]; }
  get current(): T { return this.transactionValue ?? this.entries[this.cursor]; }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length - 1; }
  get count() { return this.entries.length; }
  get index() { return this.cursor; }
  get inTransaction() { return this.baseline !== undefined; }
  equal(a: T, b: T) { return JSON.stringify(a) === JSON.stringify(b); }
  flush(snapshot: T) {
    if (this.inTransaction || this.equal(this.entries[this.cursor], snapshot)) return;
    this.entries = [...this.entries.slice(0, this.cursor + 1), snapshot].slice(-this.limit);
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
