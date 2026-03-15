import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const PHOTOS_BUCKET = "photos";
const BACKUPS_BUCKET = "db-backups";

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: PHOTOS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  console.log(`Uploading ${key} to ${PHOTOS_BUCKET}`);

  try {
    await r2Client.send(command);
  } catch (e: any) {
    console.error("R2 put failed:", {
      name: e?.name,
      message: e?.message,
      Code: e?.Code,
      $metadata: e?.$metadata,
    });
    throw e;
  }
}

export async function getSignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: PHOTOS_BUCKET,
    Key: key,
  });

  // Note: We use DeleteObjectCommand but only to get the base URL structure
  // In production, you'd want a GetObjectCommand for signed URLs
  // But for R2, we can construct the URL directly or use presigned URLs
  const url = `${process.env.R2_ENDPOINT}/photos/${key}`;

  // For private buckets, generate signed URL (expires in 1 hour)
  try {
    const presignedUrl = await awsGetSignedUrl(r2Client, command, {
      expiresIn: 3600,
    });
    return presignedUrl;
  } catch {
    // Fallback to direct URL if signing fails
    return url;
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: PHOTOS_BUCKET,
    Key: key,
  });

  await r2Client.send(command);
}

export function generatePictureKey(
  userId: number,
  filename: string,
  type: "original" | "compressed" | "thumbnail",
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();

  // Extract extension from filename
  const ext = filename.split(".").pop() || "jpg";

  // For thumbnails, always use webp
  const finalExt = type === "thumbnail" ? "webp" : ext;

  return `users/${userId}/${year}/${month}/${uuid}-${type}.${finalExt}`;
}

export async function uploadBackupToR2(
  backupKey: string,
  dbBuffer: Buffer,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BACKUPS_BUCKET,
    Key: backupKey,
    Body: dbBuffer,
    ContentType: "application/x-sqlite3",
  });

  await r2Client.send(command);
}

export { r2Client };
