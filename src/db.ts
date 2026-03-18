import { Database } from "bun:sqlite";
import type { User, Picture, Tag, Like, Session, PictureUploadMetadata, GetPicturesFilters, CameraInfo } from "./types";

const dbPath = process.env.DATABASE_PATH || "./data/photos.db";
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pictures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_r2_key TEXT NOT NULL,
    compressed_r2_key TEXT NOT NULL,
    thumbnail_r2_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    compressed_size INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    description TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_pictures_user_id ON pictures(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_pictures_uploaded_at ON pictures(uploaded_at)`);

// EXIF camera info migration — idempotent, safe to run on every startup
const exifColumns = [
  "ALTER TABLE pictures ADD COLUMN camera_make TEXT",
  "ALTER TABLE pictures ADD COLUMN camera_model TEXT",
  "ALTER TABLE pictures ADD COLUMN lens_model TEXT",
  "ALTER TABLE pictures ADD COLUMN f_number REAL",
  "ALTER TABLE pictures ADD COLUMN exposure_time TEXT",
  "ALTER TABLE pictures ADD COLUMN iso INTEGER",
  "ALTER TABLE pictures ADD COLUMN focal_length REAL",
  "ALTER TABLE pictures ADD COLUMN frame TEXT DEFAULT 'none'",
];
for (const sql of exifColumns) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

// Google Photos token migration — idempotent
const tokenColumns = [
  "ALTER TABLE users ADD COLUMN google_access_token TEXT",
  "ALTER TABLE users ADD COLUMN google_refresh_token TEXT",
  "ALTER TABLE users ADD COLUMN google_token_expires_at DATETIME",
];
for (const sql of tokenColumns) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS picture_tags (
    picture_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (picture_id, tag_id),
    FOREIGN KEY (picture_id) REFERENCES pictures(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_picture_tags_tag_id ON picture_tags(tag_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_picture_tags_picture_id ON picture_tags(picture_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    picture_id INTEGER NOT NULL,
    is_like BOOLEAN NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, picture_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (picture_id) REFERENCES pictures(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_likes_picture_id ON likes(picture_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);

// User functions
export function getUserByGoogleId(googleId: string): User | null {
  const stmt = db.prepare("SELECT * FROM users WHERE google_id = ?");
  return stmt.get(googleId) as User | null;
}

export function getUserById(userId: number): User | null {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return stmt.get(userId) as User | null;
}

export function createUser(googleId: string, email: string, name: string, avatarUrl: string | null): User {
  const stmt = db.prepare(
    "INSERT INTO users (google_id, email, name, avatar_url) VALUES (?, ?, ?, ?) RETURNING *"
  );
  return stmt.get(googleId, email, name, avatarUrl) as User;
}

export function updateUserLogin(userId: number): void {
  const stmt = db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
  stmt.run(userId);
}

export function storeGoogleTokens(
  userId: number,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date,
): void {
  const stmt = db.prepare(
    "UPDATE users SET google_access_token = ?, google_refresh_token = COALESCE(?, google_refresh_token), google_token_expires_at = ? WHERE id = ?"
  );
  stmt.run(accessToken, refreshToken, expiresAt.toISOString(), userId);
}

export function getGoogleTokens(userId: number): { google_access_token: string | null; google_refresh_token: string | null; google_token_expires_at: string | null } | null {
  const stmt = db.prepare(
    "SELECT google_access_token, google_refresh_token, google_token_expires_at FROM users WHERE id = ?"
  );
  return stmt.get(userId) as { google_access_token: string | null; google_refresh_token: string | null; google_token_expires_at: string | null } | null;
}

// Session functions
export function createSession(userId: number): string {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

  const stmt = db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  );
  stmt.run(sessionId, userId, expiresAt.toISOString());

  return sessionId;
}

export function validateSession(sessionId: string): User | null {
  const stmt = db.prepare(`
    SELECT u.* FROM users u
    JOIN sessions s ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
  `);
  return stmt.get(sessionId) as User | null;
}

export function deleteSession(sessionId: string): void {
  const stmt = db.prepare("DELETE FROM sessions WHERE id = ?");
  stmt.run(sessionId);
}

export function cleanupExpiredSessions(): void {
  const stmt = db.prepare("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP");
  stmt.run();
}

// Picture functions
export function uploadPicture(metadata: PictureUploadMetadata): Picture {
  const stmt = db.prepare(`
    INSERT INTO pictures (
      user_id, original_r2_key, compressed_r2_key, thumbnail_r2_key,
      original_filename, original_size, compressed_size, width, height,
      mime_type, description, frame,
      camera_make, camera_model, lens_model, f_number, exposure_time, iso, focal_length
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);

  return stmt.get(
    metadata.userId,
    metadata.originalKey,
    metadata.compressedKey,
    metadata.thumbnailKey,
    metadata.originalFilename,
    metadata.originalSize,
    metadata.compressedSize,
    metadata.width,
    metadata.height,
    metadata.mimeType,
    metadata.description || null,
    metadata.frame || 'none',
    metadata.cameraMake ?? null,
    metadata.cameraModel ?? null,
    metadata.lensModel ?? null,
    metadata.fNumber ?? null,
    metadata.exposureTime ?? null,
    metadata.iso ?? null,
    metadata.focalLength ?? null,
  ) as Picture;
}

export function getUserCameras(userId: number): CameraInfo[] {
  const stmt = db.prepare(`
    SELECT camera_make, camera_model, COUNT(*) as photo_count
    FROM pictures
    WHERE user_id = ? AND (camera_make IS NOT NULL OR camera_model IS NOT NULL)
    GROUP BY camera_make, camera_model
    ORDER BY photo_count DESC
  `);
  return stmt.all(userId) as CameraInfo[];
}

export function getPictureById(pictureId: number): Picture | null {
  const stmt = db.prepare(`
    SELECT p.*, u.name as user_name, u.avatar_url as user_avatar
    FROM pictures p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `);
  return stmt.get(pictureId) as Picture | null;
}

export function getPictures(filters: GetPicturesFilters = {}): Picture[] {
  const { userId, tags, offset = 0, limit = 20 } = filters;

  let query = `
    SELECT DISTINCT p.*, u.name as user_name, u.avatar_url as user_avatar
    FROM pictures p
    JOIN users u ON p.user_id = u.id
  `;

  const conditions: string[] = [];
  const params: any[] = [];

  if (userId) {
    conditions.push("p.user_id = ?");
    params.push(userId);
  }

  if (tags && tags.length > 0) {
    query += `
      JOIN picture_tags pt ON p.id = pt.picture_id
      JOIN tags t ON pt.tag_id = t.id
    `;
    const tagPlaceholders = tags.map(() => "?").join(",");
    conditions.push(`t.name IN (${tagPlaceholders})`);
    params.push(...tags);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.uploaded_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = db.prepare(query);
  return stmt.all(...params) as Picture[];
}

export function getFeed(offset: number = 0, limit: number = 20): Picture[] {
  const stmt = db.prepare(`
    SELECT p.*, u.name as user_name, u.avatar_url as user_avatar
    FROM pictures p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.uploaded_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as Picture[];
}

export function getTimeline(userId: number, offset: number = 0, limit: number = 20, tags?: string[]): Picture[] {
  let query = `
    SELECT DISTINCT p.*, u.name as user_name, u.avatar_url as user_avatar
    FROM pictures p
    JOIN users u ON p.user_id = u.id
  `;

  const params: any[] = [];

  if (tags && tags.length > 0) {
    query += `
      JOIN picture_tags pt ON p.id = pt.picture_id
      JOIN tags t ON pt.tag_id = t.id
    `;
    const tagPlaceholders = tags.map(() => "?").join(",");
    query += ` WHERE p.user_id = ? AND t.name IN (${tagPlaceholders})`;
    params.push(userId, ...tags);
  } else {
    query += " WHERE p.user_id = ?";
    params.push(userId);
  }

  query += " ORDER BY p.uploaded_at ASC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db.prepare(query).all(...params) as Picture[];
}

export function updatePictureDescription(pictureId: number, description: string): void {
  const stmt = db.prepare("UPDATE pictures SET description = ? WHERE id = ?");
  stmt.run(description, pictureId);
}

export function updatePictureFrame(pictureId: number, frame: string): void {
  db.prepare("UPDATE pictures SET frame = ? WHERE id = ?").run(frame, pictureId);
}

export function deletePicture(pictureId: number): Picture | null {
  const picture = getPictureById(pictureId);
  if (!picture) return null;

  const stmt = db.prepare("DELETE FROM pictures WHERE id = ?");
  stmt.run(pictureId);

  return picture;
}

// Tag functions
export function getAllTags(): Tag[] {
  const stmt = db.prepare(`
    SELECT t.id, t.name, COUNT(pt.picture_id) as count
    FROM tags t
    LEFT JOIN picture_tags pt ON t.id = pt.tag_id
    GROUP BY t.id, t.name
    ORDER BY count DESC, t.name ASC
  `);
  return stmt.all() as Tag[];
}

export function getPictureTags(pictureId: number): Tag[] {
  const stmt = db.prepare(`
    SELECT t.* FROM tags t
    JOIN picture_tags pt ON t.id = pt.tag_id
    WHERE pt.picture_id = ?
    ORDER BY t.name ASC
  `);
  return stmt.all(pictureId) as Tag[];
}

export function addTags(pictureId: number, tagNames: string[]): void {
  for (const tagName of tagNames) {
    const normalizedTag = tagName.trim().toLowerCase();
    if (!normalizedTag) continue;

    // Upsert tag
    const tagStmt = db.prepare(
      "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name=name RETURNING id"
    );
    const tag = tagStmt.get(normalizedTag) as { id: number };

    // Link to picture (ignore if already exists)
    const linkStmt = db.prepare(
      "INSERT OR IGNORE INTO picture_tags (picture_id, tag_id) VALUES (?, ?)"
    );
    linkStmt.run(pictureId, tag.id);
  }
}

export function removeTags(pictureId: number, tagNames: string[]): void {
  const normalizedTags = tagNames.map(t => t.trim().toLowerCase());
  const placeholders = normalizedTags.map(() => "?").join(",");

  const stmt = db.prepare(`
    DELETE FROM picture_tags
    WHERE picture_id = ? AND tag_id IN (
      SELECT id FROM tags WHERE name IN (${placeholders})
    )
  `);
  stmt.run(pictureId, ...normalizedTags);
}

// Like functions
export function toggleLike(userId: number, pictureId: number, isLike: boolean): void {
  // Check if like already exists
  const checkStmt = db.prepare(
    "SELECT is_like FROM likes WHERE user_id = ? AND picture_id = ?"
  );
  const existing = checkStmt.get(userId, pictureId) as { is_like: number } | null;

  if (existing) {
    if (existing.is_like === (isLike ? 1 : 0)) {
      // Same vote, remove it
      const deleteStmt = db.prepare("DELETE FROM likes WHERE user_id = ? AND picture_id = ?");
      deleteStmt.run(userId, pictureId);
    } else {
      // Different vote, update it
      const updateStmt = db.prepare(
        "UPDATE likes SET is_like = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ? AND picture_id = ?"
      );
      updateStmt.run(isLike ? 1 : 0, userId, pictureId);
    }
  } else {
    // New vote
    const insertStmt = db.prepare(
      "INSERT INTO likes (user_id, picture_id, is_like) VALUES (?, ?, ?)"
    );
    insertStmt.run(userId, pictureId, isLike ? 1 : 0);
  }
}

export function getLikeCounts(pictureId: number): { likes: number; dislikes: number } {
  const stmt = db.prepare(`
    SELECT
      SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as likes,
      SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislikes
    FROM likes
    WHERE picture_id = ?
  `);
  const result = stmt.get(pictureId) as { likes: number | null; dislikes: number | null };
  return {
    likes: result.likes || 0,
    dislikes: result.dislikes || 0,
  };
}

export function getUserLike(userId: number, pictureId: number): boolean | null {
  const stmt = db.prepare("SELECT is_like FROM likes WHERE user_id = ? AND picture_id = ?");
  const result = stmt.get(userId, pictureId) as { is_like: number } | null;
  if (result === null) return null;
  return result.is_like === 1;
}

console.log(`Database initialized at ${dbPath}`);
