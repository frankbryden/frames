import sharp from "sharp";
import exifr from "exifr";
import type { CompressionResult } from "./types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const COMPRESSED_MAX_WIDTH = 1920;
const THUMBNAIL_MAX_WIDTH = 400;
const COMPRESSED_QUALITY = 85;
const THUMBNAIL_QUALITY = 80;

export async function compressImage(fileBuffer: Buffer): Promise<CompressionResult> {
  // Validate file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }

  const image = sharp(fileBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image: could not read dimensions");
  }

  // Extract EXIF from original buffer before compression strips it
  const cameraInfo: CompressionResult["metadata"]["cameraInfo"] = {
    cameraMake: null,
    cameraModel: null,
    lensModel: null,
    fNumber: null,
    exposureTime: null,
    iso: null,
    focalLength: null,
  };
  try {
    const exif = await exifr.parse(fileBuffer, {
      pick: ["Make", "Model", "LensModel", "FNumber", "ExposureTime", "ISO", "FocalLength"],
    });
    if (exif) {
      cameraInfo.cameraMake = exif.Make ?? null;
      cameraInfo.cameraModel = exif.Model ?? null;
      cameraInfo.lensModel = exif.LensModel ?? null;
      cameraInfo.fNumber = exif.FNumber ?? null;
      if (exif.ExposureTime != null) {
        const et = exif.ExposureTime as number;
        cameraInfo.exposureTime = et < 1 ? `1/${Math.round(1 / et)}s` : `${et}s`;
      }
      cameraInfo.iso = exif.ISO ?? null;
      cameraInfo.focalLength = exif.FocalLength ?? null;
    }
  } catch {
    // No EXIF or unreadable — leave all fields null
  }

  // Compressed version (1920px max width, 85% quality, progressive JPEG)
  const compressed = await image
    .resize(COMPRESSED_MAX_WIDTH, null, {
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality: COMPRESSED_QUALITY, progressive: true })
    .toBuffer();

  // Thumbnail (400px max width, 80% quality, WebP format)
  const thumbnail = await sharp(fileBuffer)
    .resize(THUMBNAIL_MAX_WIDTH, null, {
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return {
    original: fileBuffer,
    compressed,
    thumbnail,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format || "unknown",
      originalSize: fileBuffer.length,
      compressedSize: compressed.length,
      cameraInfo,
    },
  };
}

export function validateImageFile(contentType: string, size: number): void {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

  if (!allowedTypes.includes(contentType)) {
    throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(", ")}`);
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }
}
