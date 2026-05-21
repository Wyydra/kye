import jsQR from "jsqr";

/**
 * Captures a frame from a HTMLVideoElement and attempts to decode a QR code.
 * Returns the decoded string if found, otherwise null.
 */
export function scanQrFromVideo(video: HTMLVideoElement): string | null {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      return code.data;
    }
  }
  return null;
}
