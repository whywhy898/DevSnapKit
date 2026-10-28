const ORDER = ['1.91:1', '16:9', '4:3', '1:1', '4:5', '9:16'];

export function templateRatio(width: number, height: number) {
  let a = width, b = height;
  while (b) [a, b] = [b, a % b];
  const exact = `${width / a}:${height / a}`;
  const key = exact === '40:21' || exact === '300:157' ? '1.91:1' : exact;
  return { exact, key };
}

export function groupTemplates<T extends { width: number; height: number }>(items: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const { key } = templateRatio(item.width, item.height);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => {
    const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
    return (ai < 0 ? ORDER.length : ai) - (bi < 0 ? ORDER.length : bi) || a.localeCompare(b);
  }).map(([key, entries]) => ({ key, items: entries }));
}
