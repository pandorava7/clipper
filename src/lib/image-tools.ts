export type LoadedImageFile = {
  file: File;
  url: string;
  name: string;
  naturalWidth: number;
  naturalHeight: number;
};

export async function loadImageDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = url;
  });
}

export async function loadImageFile(file: File): Promise<LoadedImageFile> {
  const url = URL.createObjectURL(file);

  try {
    const { width, height } = await loadImageDimensions(url);
    return {
      file,
      url,
      name: file.name,
      naturalWidth: width,
      naturalHeight: height,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function revokeObjectUrl(url: string | null | undefined) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export async function blobFromCanvas(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create blob."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

export function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export function replaceFileExtension(filename: string, extension: string) {
  return filename.replace(/\.[^.]+$/, "") + extension;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeHex(value: string) {
  const raw = value.trim().replace(/^#/, "").slice(0, 6);
  const expanded = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;

  if (expanded.length !== 6 || /[^0-9a-f]/i.test(expanded)) {
    return null;
  }

  return `#${expanded.toUpperCase()}`;
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}