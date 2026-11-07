/** Rasterize an SVG in a browser. Resolves with a PNG Blob. */
export async function svgToPng(svg: string, scale = 1): Promise<Blob> {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Scale must be positive')
  if (typeof document === 'undefined' || typeof Image === 'undefined')
    throw new Error('PNG export requires a browser')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to load SVG'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(image.naturalWidth * scale)
    canvas.height = Math.ceil(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
        'image/png',
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
