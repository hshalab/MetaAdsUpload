/**
 * Generate a thumbnail from a video file (browser-side).
 * Creates a hidden video element, seeks to 1s, captures a frame.
 */
export async function generateVideoThumbnail(
  videoUrl: string,
  width = 320
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = width / video.videoWidth;
        canvas.width = width;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            video.src = "";
            resolve(blob);
          },
          "image/jpeg",
          0.8
        );
      } catch {
        resolve(null);
      }
    };

    video.onerror = () => resolve(null);

    // Timeout after 10s
    setTimeout(() => {
      video.src = "";
      resolve(null);
    }, 10000);

    video.src = videoUrl;
  });
}
