import { useCallback, useRef, useState } from 'react';
import { beginTransaction, cancelTransaction, commitTransaction, createHistory, redoHistory, undoHistory, updateTransaction, type History } from './history';

type Update<T> = T | ((current: T) => T);
export function usePosterDocument<T>(initial: T) {
  const [state, setState] = useState(() => createHistory(initial));
  const stateRef = useRef(state);
  const apply = useCallback((operation: (previous: History<T>) => History<T>) => {
    const next = operation(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);
  const begin = useCallback(() => apply(beginTransaction), [apply]);
  const update = useCallback((next: Update<T>) => apply(previous => updateTransaction(previous, typeof next === 'function' ? (next as (current: T) => T)(previous.present) : next)), [apply]);
  const commit = useCallback(() => apply(commitTransaction), [apply]);
  const cancel = useCallback(() => apply(cancelTransaction), [apply]);
  const replace = useCallback((next: Update<T>) => apply(previous => commitTransaction(updateTransaction(beginTransaction(commitTransaction(previous)), typeof next === 'function' ? (next as (current: T) => T)(previous.present) : next))), [apply]);
  const undo = useCallback(() => apply(undoHistory), [apply]);
  const redo = useCallback(() => apply(redoHistory), [apply]);
  return { document: state.present, begin, update, commit, cancel, replace, undo, redo, canUndo: state.past.length > 0 || !!state.transaction, canRedo: state.future.length > 0, revision: state.revision, inTransaction: !!state.transaction };
}
