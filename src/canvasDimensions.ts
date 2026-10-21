// Helper to compute exact nominal target resolution (independent of browser window CSS width)
export function getCanonicalDimensions(
  aspectId: string,
  scale: number,
  _domWidth: number,
  _domHeight: number,
  autoW?: number,
  autoH?: number,
  customW = 1500,
  customH = 900
): { width: number; height: number } {
  if (aspectId === 'auto' || aspectId === 'custom') {
    const baseW = aspectId === 'custom' ? customW : autoW && autoW > 0 ? autoW : 1200;
    const baseH = aspectId === 'custom' ? customH : autoH && autoH > 0 ? autoH : 776;
    if (scale === 1) {
      return { width: baseW, height: baseH };
    } else if (scale === 2) {
      return { width: baseW * 2, height: baseH * 2 };
    } else {
      // 4K Ultra HD: target standard 3840px longest edge (preserving exact aspect ratio)
      if (baseW >= baseH) {
        const targetW = 3840;
        const targetH = Math.round(targetW * (baseH / baseW));
        return { width: targetW, height: targetH };
      } else {
        const targetH = 3840;
        const targetW = Math.round(targetH * (baseW / baseH));
        return { width: targetW, height: targetH };
      }
    }
  }

  let baseWidth = 1200;
  let baseHeight = 630;

  switch (aspectId) {
    case 'og':
      baseWidth = 1200;
      baseHeight = 630;
      break;
    case '16-9':
      baseWidth = 1920;
      baseHeight = 1080;
      break;
    case '4-3':
      baseWidth = 1200;
      baseHeight = 900;
      break;
    case '1-1':
      baseWidth = 1080;
      baseHeight = 1080;
      break;
    case 'ig-post':
      baseWidth = 1080;
      baseHeight = 1350;
      break;
    case 'ig-story':
      baseWidth = 1080;
      baseHeight = 1920;
      break;
    case 'linkedin':
      baseWidth = 1200;
      baseHeight = 627;
      break;
    case 'youtube':
      baseWidth = 1280;
      baseHeight = 720;
      break;
    default:
      baseWidth = 1200;
      baseHeight = 630;
      break;
  }

  if (scale === 1) {
    return { width: baseWidth, height: baseHeight };
  } else if (scale === 2) {
    if (aspectId === '16-9' || aspectId === 'youtube') return { width: 2560, height: 1440 }; // 2K QHD
    return { width: baseWidth * 2, height: baseHeight * 2 };
  } else {
    // 4K Ultra HD resolution
    if (aspectId === 'og') return { width: 3840, height: 2016 };
    if (aspectId === '16-9' || aspectId === 'youtube') return { width: 3840, height: 2160 };
    if (aspectId === '4-3') return { width: 3200, height: 2400 };
    if (aspectId === '1-1') return { width: 3840, height: 3840 };
    if (aspectId === 'ig-post') return { width: 3072, height: 3840 };
    if (aspectId === 'ig-story') return { width: 2160, height: 3840 };
    if (aspectId === 'linkedin') return { width: 3840, height: 2006 };
    return { width: baseWidth * 3, height: baseHeight * 3 };
  }
}
