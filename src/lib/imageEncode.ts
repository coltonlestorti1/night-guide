/**
 * Canvas re-encode: downscale an image and re-emit it as JPEG.
 *
 * ⚠️ THE REDRAW IS THE EXIF STRIP, NOT A RESIZE CONVENIENCE.
 * Rebuilding the image from raw pixels discards all metadata. Camera EXIF
 * carries GPS coordinates and an exact capture time — precisely what
 * night_posts.night_date exists to withhold — so uploading an original File
 * would undo that privacy design through a side channel. Any future "skip the
 * resize when the image is already small" optimisation must still round-trip
 * through the canvas.
 *
 * Browser-only: createImageBitmap and canvas do not exist under Node, which is
 * why callers of this are verified in the browser rather than in Vitest.
 */
export async function reencodeImage(
  file: File,
  { maxEdge, quality = 0.85 }: { maxEdge: number; quality?: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      quality,
    ),
  );
}
