// Shrink a camera photo before it goes anywhere near festival signal:
// ~1280 px longest edge, JPEG q≈0.6, aiming for ≤150 KB.

async function load(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall through to <img> (older Safari, HEIC edge cases) */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function encode(src: ImageBitmap | HTMLImageElement, maxEdge: number, q: number): Promise<Blob> {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const k = Math.min(1, maxEdge / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * k)
  c.height = Math.round(h * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q))
}

export async function compressPhoto(file: Blob): Promise<Blob> {
  const src = await load(file)
  let out = await encode(src, 1280, 0.6)
  if (out.size > 150_000) out = await encode(src, 1080, 0.5)
  if (out.size > 150_000) out = await encode(src, 900, 0.45)
  return out
}
