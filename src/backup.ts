import { readFile } from "fs/promises";
import { uploadBackupToR2 } from "./r2";

const DB_PATH = process.env.DATABASE_PATH || "./data/photos.db";

export async function backupDatabase(): Promise<void> {
  try {
    const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const backupKey = `${timestamp}-photos.db`;

    console.log(`Starting database backup: ${backupKey}`);

    // Read database file
    const dbBuffer = await readFile(DB_PATH);

    // Upload to R2 backups bucket
    await uploadBackupToR2(backupKey, dbBuffer);

    console.log(`✅ Backup completed successfully: ${backupKey}`);
  } catch (error) {
    console.error("❌ Backup failed:", error);
    throw error;
  }
}

export function startBackupScheduler(): void {
  const CHECK_INTERVAL = 60 * 1000; // Check every minute

  setInterval(() => {
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    // Run at 2:00 AM UTC
    if (hour === 2 && minute === 0) {
      backupDatabase().catch(err => {
        console.error("Scheduled backup failed:", err);
      });
    }
  }, CHECK_INTERVAL);

  console.log("📅 Backup scheduler started (runs daily at 2:00 AM UTC)");
}
