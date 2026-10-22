import { getFontEmbedCSS } from 'html-to-image';

const fontCSS = new Map<string, Promise<string>>();
const imageData = new WeakMap<Blob, Promise<string>>();
const decodedImages = new Map<string, Promise<void>>();
const ownedFontData = new Map<string, Promise<string>>();
const failedOwnedLoads = new Set<string>();
const recoveredFaces = new Map<string, Promise<FontFace>>();
const loadedRecoveries = new Set<string>();
// Our three licensed same-origin faces use recoverable promises. html-to-image
// caches failed resource fetches as empty strings, so it must not own these URLs.
const ownedFaces = [
  { family: 'Poster Manrope', style: 'normal', weights: '200 800', url: '/poster/fonts/manrope-latin.woff2', format: 'woff2' },
  { family: 'Poster Gelasio', style: 'normal', weights: '400 700', url: '/poster/fonts/Gelasio.ttf', format: 'truetype' },
  { family: 'Poster Gelasio', style: 'italic', weights: '400 700', url: '/poster/fonts/Gelasio-Italic.ttf', format: 'truetype' },
];
export function createArtworkPreparationStats() {
  return { fontPreparationCalls: 0, fontCSSCacheHits: 0, fontCSSCacheMisses: 0, fontResourceFetches: 0, fontResourceCacheHits: 0,
    imagePreparationCalls: 0, imageAssetDecodeCalls: 0, imageAssetCacheHits: 0, imageDOMReadinessCalls: 0, blobConversions: 0, blobCacheHits: 0 };
}
export type ArtworkPreparationStats = ReturnType<typeof createArtworkPreparationStats>;
type OwnedFace = typeof ownedFaces[number];
const ownedFaceIdentity = (face: OwnedFace) => `${face.family}|${face.style}|${face.weights}|${face.url}`;

function ownedFontURL(face: OwnedFace, stats?: ArtworkPreparationStats): Promise<string> {
  let data = ownedFontData.get(face.url);
  if (!data) {
    if (stats) stats.fontResourceFetches++;
    data = (async () => {
      const response = await fetch(face.url);
      if (!response.ok) throw new Error('Font response failed');
      return inlineLocalImage(await response.blob());
    })();
    ownedFontData.set(face.url, data);
    data.catch(() => ownedFontData.delete(face.url));
  } else if (stats) stats.fontResourceCacheHits++;
  return data;
}

async function recoverOwnedFace(face: OwnedFace): Promise<void> {
  const identity = ownedFaceIdentity(face);
  let recovery = recoveredFaces.get(identity);
  if (!recovery) {
    recovery = (async () => {
      const replacement = new FontFace(face.family, `url("${await ownedFontURL(face)}")`, { style: face.style, weight: face.weights });
      await replacement.load();
      document.fonts.add(replacement);
      loadedRecoveries.add(identity);
      return replacement;
    })();
    recoveredFaces.set(identity, recovery);
    recovery.catch(() => { recoveredFaces.delete(identity); ownedFontData.delete(face.url); });
  }
  await recovery;
}

async function embedOwnedFaces(used: string[], stats?: ArtworkPreparationStats): Promise<string> {
  const faces = ownedFaces.filter(face => used.some(font => font.includes(face.family) && font.startsWith(`${face.style} `)));
  return (await Promise.all(faces.map(async face => {
    try {
      return `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weights};src:url("${await ownedFontURL(face, stats)}") format("${face.format}");}`;
    } catch {
      const identities = used.filter(font => font.includes(face.family) && font.startsWith(`${face.style} `));
      throw new Error(`Font ${identities.join(', ')} could not be embedded. Check your connection and try again.`);
    }
  }))).join('\n');
}

export function inlineLocalImage(blob: Blob, stats?: ArtworkPreparationStats): Promise<string> {
  let cached = imageData.get(blob);
  if (!cached) {
    if (stats) stats.blobConversions++;
    cached = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Local image could not be prepared.'));
      reader.onerror = () => reject(new Error('Local image could not be prepared.'));
      reader.readAsDataURL(blob);
    });
    imageData.set(blob, cached);
    cached.catch(() => imageData.delete(blob));
  } else if (stats) stats.blobCacheHits++;
  return cached;
}

function imageDOMReady(image: HTMLImageElement): Promise<void> {
  if (image.complete) return image.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error('Empty image'));
  return new Promise((resolve, reject) => {
    const cleanup = () => { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
    const loaded = () => { cleanup(); image.naturalWidth > 0 ? resolve() : reject(new Error('Empty image')); };
    const failed = () => { cleanup(); reject(new Error('Image load failed')); };
    image.addEventListener('load', loaded, { once: true }); image.addEventListener('error', failed, { once: true });
    // A cache hit can complete between the initial check and listener setup.
    if (image.complete) loaded();
  });
}

export async function prepareArtworkImages(root: HTMLElement, resolveBlob?: (url: string) => Blob | undefined, stats?: ArtworkPreparationStats) {
  if (stats) stats.imagePreparationCalls++;
  await Promise.all([...root.querySelectorAll('img')].map(async image => {
    const original = image.src;
    if (original.startsWith('blob:')) {
      const blob = resolveBlob?.(original);
      if (!blob) throw new Error(`${image.alt || 'Image'} is no longer available. Replace it and try again.`);
      image.src = await inlineLocalImage(blob, stats);
    }
    let ready = decodedImages.get(image.src);
    if (!ready) {
      if (stats) stats.imageAssetDecodeCalls++;
      const probe = new Image(); probe.src = image.src;
      ready = probe.decode().then(() => { if (!probe.naturalWidth) throw new Error('Empty image'); });
      decodedImages.set(image.src, ready);
      const key = image.src; ready.catch(() => decodedImages.delete(key));
      // Keep the process cache bounded; a frozen batch shares its identities.
      if (decodedImages.size > 100) decodedImages.delete(decodedImages.keys().next().value!);
    } else if (stats) stats.imageAssetCacheHits++;
    // Decode the source once. Each target still needs loaded intrinsic geometry,
    // which complete/load+naturalWidth provides without another decode() call.
    try { await ready; if (stats) stats.imageDOMReadinessCalls++; await imageDOMReady(image); }
    catch { throw new Error(`${image.alt || 'Image'} could not be loaded. Replace it and try again.`); }
  }));
}

export async function ensureArtworkFonts(used: string[]): Promise<void> {
  await Promise.all([...new Set(used)].map(async font => {
    const owned = ownedFaces.find(face => font.includes(face.family) && font.startsWith(`${face.style} `));
    try {
      // An errored CSS FontFace never restarts its original load promise. On the
      // next attempt, add a successfully loaded replacement of our own face.
      if (owned && failedOwnedLoads.has(ownedFaceIdentity(owned))) await recoverOwnedFace(owned);
      else await document.fonts.load(font);
    } catch {
      if (owned) failedOwnedLoads.add(ownedFaceIdentity(owned));
      throw new Error(`Font ${font} could not be loaded. Check your connection and try again.`);
    }
  }));
  await document.fonts.ready;
  const missing = used.filter(font => {
    const owned = ownedFaces.find(face => font.includes(face.family) && font.startsWith(`${face.style} `));
    // FontFaceSet.check still includes the permanent CSS errors in Chrome even
    // after the newer successfully loaded face is used for actual glyph layout.
    return !(owned && loadedRecoveries.has(ownedFaceIdentity(owned))) && !document.fonts.check(font);
  });
  if (missing.length) throw new Error(`Font ${missing.join(', ')} could not be loaded. Check your connection and try again.`);
}

export async function artworkFontCSS(root: HTMLElement, identities?: string[], stats?: ArtworkPreparationStats): Promise<string> {
  if (stats) stats.fontPreparationCalls++;
  const used = identities ?? [...root.querySelectorAll<HTMLElement>('*')].map(node => {
    const css = getComputedStyle(node); return `${css.fontStyle} ${css.fontWeight} 16px ${css.fontFamily}`;
  });
  const key = [...new Set(used)].sort().join('|');
  await ensureArtworkFonts(used);
  let promise = fontCSS.get(key);
  if (!promise) {
    if (stats) stats.fontCSSCacheMisses++;
    promise = (async () => {
      const ownedCSS = await embedOwnedFaces(used, stats);
      // Probe only the other used families, keeping compatibility with the app's
      // body fonts without routing our recoverable faces through library caches.
      const fontProbe = root.ownerDocument?.createElement('div') ?? document.createElement('div');
      const families = used.flatMap(font => (font.match(/16px\s+(.+)$/)?.[1] ?? '').split(','))
        .filter(family => !ownedFaces.some(face => family.includes(face.family)));
      fontProbe.style.fontFamily = [...new Set(families)].join(',') || 'sans-serif';
      return `${await getFontEmbedCSS(fontProbe)}\n${ownedCSS}`;
    })().catch(error => {
      fontCSS.delete(key);
      if (error instanceof Error && /could not be embedded/.test(error.message)) throw error;
      throw new Error(`Fonts ${key} could not be embedded. Check your connection and try again.`);
    });
    fontCSS.set(key, promise);
    if (fontCSS.size > 30) fontCSS.delete(fontCSS.keys().next().value!);
  } else if (stats) stats.fontCSSCacheHits++;
  const css = await promise;
  const faces = [...css.matchAll(/@font-face\s*\{[^}]+\}/gi)].map(match => match[0]);
  const incomplete = used.filter(font => {
    const family = font.match(/Poster (?:Manrope|Gelasio)/)?.[0];
    if (!family) return false;
    const style = font.startsWith('italic ') ? 'italic' : 'normal';
    const weight = Number(font.match(/\s(\d+)\s+16px/)?.[1] ?? 400);
    return !faces.some(face => {
      const faceFamily = face.match(/font-family:\s*([^;]+)/i)?.[1] ?? '';
      const faceStyle = face.match(/font-style:\s*([^;]+)/i)?.[1]?.trim() ?? 'normal';
      const weights = (face.match(/font-weight:\s*([^;]+)/i)?.[1] ?? '400').match(/\d+/g)?.map(Number) ?? [400];
      return faceFamily.includes(family) && faceStyle === style && weight >= weights[0] && weight <= weights[weights.length - 1]
        && /url\(\s*["']?data:[^"')]*;base64,[A-Za-z0-9+/=]+["']?\s*\)/i.test(face);
    });
  });
  if (incomplete.length) {
    fontCSS.delete(key);
    throw new Error(`Fonts ${incomplete.join(', ')} could not be embedded. Check your connection and try again.`);
  }
  return css;
}

export async function stableArtworkLayout(root: HTMLElement) {
  let previous = '', stable = 0;
  for (let frame = 0; frame < 30; frame++) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const signature = [...root.querySelectorAll<HTMLElement>('[data-scene-fit],[data-scene-bounds],[data-canvas-text]')]
      .map(node => `${node.offsetWidth},${node.offsetHeight},${node.style.cssText}`).join('|');
    stable = signature === previous ? stable + 1 : 0; previous = signature;
    if (stable >= 3) return;
  }
  throw new Error('Artwork layout did not settle. Please try again.');
}
