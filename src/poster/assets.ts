export type PosterAsset = { id: string; url: string; width: number; height: number; name: string; type: string; blob?: Blob };
type Check = { ok: true } | { ok: false; reason: string };
export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_ASSET_PIXELS = 24_000_000;
export function validateAssetFile(file: { type: string; size: number }): Check {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return { ok: false, reason: 'Choose a PNG, JPEG or WebP image.' };
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_ASSET_BYTES) return { ok: false, reason: 'Image must be at most 20 MB.' };
  return { ok: true };
}
export function validateImageDimensions(width: number, height: number): Check {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) return { ok: false, reason: 'Image could not be decoded.' };
  if (width * height > MAX_ASSET_PIXELS) return { ok: false, reason: 'Image must be at most 24 megapixels.' };
  return { ok: true };
}

/** URLs are retained for the whole session, including references in Undo and Redo. */
export class AssetRegistry {
  private records = new Map<string, PosterAsset>();
  private disposed = false;
  register(asset: PosterAsset) { this.records.set(asset.id, asset); return asset; }
  get(id: string | null | undefined) { return id ? this.records.get(id) : undefined; }
  resolve(id: string | null | undefined) { return this.get(id)?.url; }
  getBlob(url: string) {
    for (const asset of this.records.values()) if (asset.url === url) return asset.blob;
    return undefined;
  }
  async add(file: File): Promise<PosterAsset> {
    if (this.disposed) throw new Error('This editing session has closed.');
    const check = validateAssetFile(file);
    if (!check.ok) throw new Error(check.reason);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const dimensions = validateImageDimensions(image.naturalWidth, image.naturalHeight);
      if (!dimensions.ok) throw new Error(dimensions.reason);
      if (this.disposed) throw new Error('This editing session has closed.');
      const asset = { id: crypto.randomUUID(), url, width: image.naturalWidth, height: image.naturalHeight, name: file.name, type: file.type, blob: file };
      return this.register(asset);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw new Error(error instanceof Error && /20 MB|24 megapixels|closed/.test(error.message) ? error.message : 'Image could not be decoded. Choose another file.');
    }
  }
  dispose() {
    this.disposed = true;
    for (const asset of this.records.values()) if (asset.url.startsWith('blob:')) URL.revokeObjectURL(asset.url);
    this.records.clear();
  }
}
