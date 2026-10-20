export type History<T> = { past: T[]; present: T; future: T[]; transaction: { baseline: T } | null; revision: number };
const same = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
export function createHistory<T>(initial: T): History<T> { return { past: [], present: initial, future: [], transaction: null, revision: 0 }; }
export function beginTransaction<T>(state: History<T>): History<T> { return state.transaction ? state : { ...state, transaction: { baseline: state.present } }; }
export function updateTransaction<T>(state: History<T>, document: T): History<T> {
  const active = beginTransaction(state);
  return same(active.present, document) ? active : { ...active, present: document, revision: active.revision + 1 };
}
export function commitTransaction<T>(state: History<T>): History<T> {
  if (!state.transaction) return state;
  if (same(state.transaction.baseline, state.present)) return { ...state, transaction: null };
  return { ...state, past: [...state.past, state.transaction.baseline].slice(-50), future: [], transaction: null };
}
export function cancelTransaction<T>(state: History<T>): History<T> {
  if (!state.transaction) return state;
  return { ...state, present: state.transaction.baseline, transaction: null, revision: state.revision + 1 };
}
export function undoHistory<T>(state: History<T>): History<T> {
  const active = commitTransaction(state);
  if (!active.past.length) return active;
  return { ...active, past: active.past.slice(0, -1), present: active.past[active.past.length - 1], future: [active.present, ...active.future], revision: active.revision + 1 };
}
export function redoHistory<T>(state: History<T>): History<T> {
  const active = commitTransaction(state);
  if (!active.future.length) return active;
  return { ...active, past: [...active.past, active.present].slice(-50), present: active.future[0], future: active.future.slice(1), revision: active.revision + 1 };
}
