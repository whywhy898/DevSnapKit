import sharp from 'sharp';

export async function rgbaDiff(left, right) {
  const decode = file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [a, b] = await Promise.all([decode(left), decode(right)]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { differentPixels: null, dimensionsEqual: false, left: a.info, right: b.info };
  }
  let differentPixels = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) differentPixels++;
  }
  return { differentPixels, dimensionsEqual: true, width: a.info.width, height: a.info.height };
}
