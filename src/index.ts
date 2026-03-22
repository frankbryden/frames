import { serve } from "bun";
import index from "./index.html";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

async function serveStatic(req: Request): Promise<Response> {
  const pathname = new URL(req.url).pathname;
  if (pathname.includes(".")) {
    const file = Bun.file(`dist${pathname}`);
    if (await file.exists()) {
      return new Response(file.stream(), {
        headers: {
          "Content-Type": file.type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }
  return new Response(Bun.file("dist/index.html").stream(), {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-cache",
    },
  });
}

import {
  generateGoogleAuthUrl,
  exchangeCodeForToken,
  getGoogleUserInfo,
  createOrUpdateUser,
  isEmailAllowed,
  createSessionCookie,
  clearSessionCookie,
  getUserFromSession,
  generateState,
} from "./auth";
import {
  createSession,
  deleteSession,
  uploadPicture,
  getPictures,
  getPictureById,
  getFeed,
  getTimeline,
  updatePictureDescription,
  updatePictureFrame,
  deletePicture,
  addTags,
  removeTags,
  getAllTags,
  getPictureTags,
  toggleLike,
  getLikeCounts,
  getUserLike,
  incrementViewCount,
  cleanupExpiredSessions,
  getUserById,
  getUserCameras,
  storeGoogleTokens,
  createAlbum,
  getAlbumsByUser,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  getAlbumPictures,
  addPictureToAlbum,
  removePictureFromAlbum,
  getPictureAlbums,
  getUsersWithStats,
} from "./db";
import {
  getValidToken,
  createPickerSession,
  getPickerSession,
  listPickerMediaItems,
  deletePickerSession,
  downloadMediaItem,
} from "./google-photos";
import { compressImage, validateImageFile } from "./compression";
import {
  uploadToR2,
  getSignedUrl,
  generatePictureKey,
  deleteFromR2,
} from "./r2";
import { backupDatabase, startBackupScheduler } from "./backup";
import type { User, Picture } from "./types";

const PORT = parseInt(process.env.PORT || "3000");

// Start backup scheduler
startBackupScheduler();

// Cleanup expired sessions daily
setInterval(
  () => {
    cleanupExpiredSessions();
  },
  24 * 60 * 60 * 1000,
);

// Helper to require authentication
function requireAuth(req: Request): User {
  const user = getUserFromSession(req);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

const server = serve({
  port: PORT,
  routes: {
    "/*": IS_PRODUCTION ? serveStatic : index,

    // Health check
    "/api/health": {
      async GET() {
        return Response.json({
          status: "ok",
          timestamp: new Date().toISOString(),
        });
      },
    },

    // Authentication routes
    "/auth/google": {
      async GET(req) {
        const state = generateState();
        const url = generateGoogleAuthUrl(state);

        // Set state in cookie for CSRF protection
        return new Response(null, {
          status: 302,
          headers: {
            Location: url,
            "Set-Cookie": `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
          },
        });
      },
    },

    "/auth/google/callback": {
      async GET(req) {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (!code || !state) {
          return new Response("Missing code or state", { status: 400 });
        }

        // Verify state (CSRF protection)
        const cookieHeader = req.headers.get("Cookie");
        const cookies = cookieHeader
          ? Object.fromEntries(
              cookieHeader.split("; ").map((c) => c.split("=")),
            )
          : {};
        const savedState = cookies.oauth_state;

        if (!savedState || savedState !== state) {
          return new Response("Invalid state parameter", { status: 400 });
        }

        try {
          // Exchange code for tokens
          const tokens = await exchangeCodeForToken(code);

          // Get user info from Google
          const userInfo = await getGoogleUserInfo(tokens.accessToken);

          // Check email whitelist
          if (!isEmailAllowed(userInfo.email)) {
            return new Response(
              `Access denied. Email ${userInfo.email} is not whitelisted.`,
              { status: 403 },
            );
          }

          // Create or update user
          const user = createOrUpdateUser(userInfo);

          // Store Google tokens for Photos API access
          storeGoogleTokens(user.id, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
          console.log(`Stored Google tokens for user ${user.id}, refreshToken present: ${!!tokens.refreshToken}`);

          // Create session
          const sessionId = createSession(user.id);

          // Redirect to home with session cookie
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/",
              "Set-Cookie": createSessionCookie(sessionId),
            },
          });
        } catch (error) {
          console.error("OAuth error:", error);
          return new Response("Authentication failed", { status: 500 });
        }
      },
    },

    "/auth/logout": {
      async POST(req) {
        const user = getUserFromSession(req);
        if (user) {
          const cookieHeader = req.headers.get("Cookie");
          const cookies = cookieHeader
            ? Object.fromEntries(
                cookieHeader.split("; ").map((c) => c.split("=")),
              )
            : {};
          const sessionId = cookies.session;
          if (sessionId) {
            deleteSession(sessionId);
          }
        }

        return new Response(null, {
          status: 200,
          headers: {
            "Set-Cookie": clearSessionCookie(),
          },
        });
      },
    },

    "/api/me": {
      async GET(req) {
        const user = getUserFromSession(req);
        if (!user) {
          return new Response("Unauthorized", { status: 401 });
        }
        return Response.json(user);
      },
    },

    // Picture upload
    "/api/pictures/upload": {
      async POST(req) {
        try {
          const user = requireAuth(req);

          // Parse multipart form data
          const formData = await req.formData();
          const file = formData.get("file") as File;
          const description = formData.get("description") as string | null;
          const tagsStr = formData.get("tags") as string | null;
          const frameStr = formData.get("frame") as string | null;
          const VALID_FRAMES = ['none', 'white', 'polaroid', 'dark', 'film'];
          const frame = frameStr && VALID_FRAMES.includes(frameStr) ? frameStr : 'none';

          if (!file) {
            return new Response("No file provided", { status: 400 });
          }

          // Validate file
          validateImageFile(file.type, file.size);

          // Read file buffer
          const fileBuffer = Buffer.from(await file.arrayBuffer());

          // Compress image
          const { original, compressed, thumbnail, metadata } =
            await compressImage(fileBuffer);

          // Generate R2 keys
          const originalKey = generatePictureKey(
            user.id,
            file.name,
            "original",
          );
          const compressedKey = generatePictureKey(
            user.id,
            file.name,
            "compressed",
          );
          const thumbnailKey = generatePictureKey(
            user.id,
            file.name,
            "thumbnail",
          );

          // Upload all 3 versions to R2 in parallel
          await Promise.all([
            uploadToR2(originalKey, original, file.type),
            uploadToR2(compressedKey, compressed, "image/jpeg"),
            uploadToR2(thumbnailKey, thumbnail, "image/webp"),
          ]);

          // Save metadata to database
          const picture = uploadPicture({
            userId: user.id,
            originalKey,
            compressedKey,
            thumbnailKey,
            originalFilename: file.name,
            originalSize: metadata.originalSize,
            compressedSize: metadata.compressedSize,
            width: metadata.width,
            height: metadata.height,
            mimeType: file.type,
            description: description || undefined,
            frame,
            cameraMake: metadata.cameraInfo.cameraMake,
            cameraModel: metadata.cameraInfo.cameraModel,
            lensModel: metadata.cameraInfo.lensModel,
            fNumber: metadata.cameraInfo.fNumber,
            exposureTime: metadata.cameraInfo.exposureTime,
            iso: metadata.cameraInfo.iso,
            focalLength: metadata.cameraInfo.focalLength,
            takenAt: metadata.cameraInfo.takenAt,
          });

          // Add tags if provided
          if (tagsStr) {
            const tags = tagsStr
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            if (tags.length > 0) {
              addTags(picture.id, tags);
            }
          }

          return Response.json({
            id: picture.id,
            message: "Picture uploaded successfully",
          });
        } catch (error) {
          if (error instanceof Error) {
            if (error.message === "Unauthorized") {
              return new Response("Unauthorized", { status: 401 });
            }
            return new Response(error.message, { status: 400 });
          }
          return new Response("Upload failed", { status: 500 });
        }
      },
    },

    // List pictures with filters
    "/api/pictures": {
      async GET(req) {
        try {
          requireAuth(req);

          const url = new URL(req.url);
          const userId = url.searchParams.get("userId");
          const tagsParam = url.searchParams.get("tags");
          const offset = parseInt(url.searchParams.get("offset") || "0");
          const limit = parseInt(url.searchParams.get("limit") || "20");

          const tags = tagsParam ? tagsParam.split(",") : undefined;

          const pictures = getPictures({
            userId: userId ? parseInt(userId) : undefined,
            tags,
            offset,
            limit,
          });

          // Add signed URLs and tags
          const enrichedPictures = await Promise.all(
            pictures.map(async (picture) => {
              const [
                compressedUrl,
                thumbnailUrl,
                pictureTags,
                counts,
                userLike,
              ] = await Promise.all([
                getSignedUrl(picture.compressed_r2_key),
                getSignedUrl(picture.thumbnail_r2_key),
                getPictureTags(picture.id),
                getLikeCounts(picture.id),
                getUserLike(getUserFromSession(req)!.id, picture.id),
              ]);

              return {
                ...picture,
                compressed_url: compressedUrl,
                thumbnail_url: thumbnailUrl,
                tags: pictureTags,
                like_count: counts.likes,
                dislike_count: counts.dislikes,
                user_like: userLike,
              };
            }),
          );

          return Response.json(enrichedPictures);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch pictures", { status: 500 });
        }
      },
    },

    // Get single picture
    "/api/pictures/:id": {
      async GET(req) {
        try {
          const user = requireAuth(req);
          const pictureId = parseInt(req.params.id);

          const picture = getPictureById(pictureId);
          if (!picture) {
            return new Response("Picture not found", { status: 404 });
          }

          const [
            originalUrl,
            compressedUrl,
            thumbnailUrl,
            tags,
            counts,
            userLike,
          ] = await Promise.all([
            getSignedUrl(picture.original_r2_key),
            getSignedUrl(picture.compressed_r2_key),
            getSignedUrl(picture.thumbnail_r2_key),
            getPictureTags(picture.id),
            getLikeCounts(picture.id),
            getUserLike(user.id, picture.id),
          ]);

          return Response.json({
            ...picture,
            original_url: originalUrl,
            compressed_url: compressedUrl,
            thumbnail_url: thumbnailUrl,
            tags,
            like_count: counts.likes,
            dislike_count: counts.dislikes,
            user_like: userLike,
          });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch picture", { status: 500 });
        }
      },

      async PATCH(req) {
        try {
          const user = requireAuth(req);
          const pictureId = parseInt(req.params.id);

          const picture = getPictureById(pictureId);
          if (!picture) {
            return new Response("Picture not found", { status: 404 });
          }

          if (picture.user_id !== user.id) {
            return new Response("Forbidden", { status: 403 });
          }

          const body = await req.json();
          const { description, frame } = body;
          const VALID_FRAMES = ['none', 'white', 'polaroid', 'dark', 'film'];

          if (typeof description === "string") {
            updatePictureDescription(pictureId, description);
          }

          if (typeof frame === "string" && VALID_FRAMES.includes(frame)) {
            updatePictureFrame(pictureId, frame);
          }

          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to update picture", { status: 500 });
        }
      },

      async DELETE(req) {
        try {
          const user = requireAuth(req);
          const pictureId = parseInt(req.params.id);

          const picture = getPictureById(pictureId);
          if (!picture) {
            return new Response("Picture not found", { status: 404 });
          }

          if (picture.user_id !== user.id) {
            return new Response("Forbidden", { status: 403 });
          }

          // Delete from R2
          await Promise.all([
            deleteFromR2(picture.original_r2_key),
            deleteFromR2(picture.compressed_r2_key),
            deleteFromR2(picture.thumbnail_r2_key),
          ]);

          // Delete from database
          deletePicture(pictureId);

          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to delete picture", { status: 500 });
        }
      },
    },

    // Manage picture tags
    "/api/pictures/:id/tags": {
      async POST(req) {
        try {
          const user = requireAuth(req);
          const pictureId = parseInt(req.params.id);

          const picture = getPictureById(pictureId);
          if (!picture) {
            return new Response("Picture not found", { status: 404 });
          }

          if (picture.user_id !== user.id) {
            return new Response("Forbidden", { status: 403 });
          }

          const body = await req.json();
          const { tags } = body;

          if (!Array.isArray(tags)) {
            return new Response("Invalid tags format", { status: 400 });
          }

          addTags(pictureId, tags);

          return Response.json({
            success: true,
            tags: getPictureTags(pictureId),
          });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to add tags", { status: 500 });
        }
      },

      async DELETE(req) {
        try {
          const user = requireAuth(req);
          const pictureId = parseInt(req.params.id);

          const picture = getPictureById(pictureId);
          if (!picture) {
            return new Response("Picture not found", { status: 404 });
          }

          if (picture.user_id !== user.id) {
            return new Response("Forbidden", { status: 403 });
          }

          const body = await req.json();
          const { tags } = body;

          if (!Array.isArray(tags)) {
            return new Response("Invalid tags format", { status: 400 });
          }

          removeTags(pictureId, tags);

          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to remove tags", { status: 500 });
        }
      },
    },

    // Like/dislike picture
    "/api/pictures/:id/like": {
      async POST(req) {
        try {
          const user = requireAuth(req);
          const pictureId = parseInt(req.params.id);

          const body = await req.json();
          const { isLike } = body;

          if (typeof isLike !== "boolean") {
            return new Response("Invalid isLike value", { status: 400 });
          }

          toggleLike(user.id, pictureId, isLike);

          const counts = getLikeCounts(pictureId);
          const userLike = getUserLike(user.id, pictureId);

          return Response.json({
            success: true,
            like_count: counts.likes,
            dislike_count: counts.dislikes,
            user_like: userLike,
          });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to toggle like", { status: 500 });
        }
      },
    },

    // Track picture view
    "/api/pictures/:id/view": {
      async POST(req) {
        try {
          requireAuth(req);
          const pictureId = parseInt(req.params.id);
          incrementViewCount(pictureId);
          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to record view", { status: 500 });
        }
      },
    },

    // Get feed (all users, reverse chronological)
    "/api/feed": {
      async GET(req) {
        try {
          const user = requireAuth(req);

          const url = new URL(req.url);
          const offset = parseInt(url.searchParams.get("offset") || "0");
          const limit = parseInt(url.searchParams.get("limit") || "20");

          const pictures = getFeed(offset, limit);

          const enrichedPictures = await Promise.all(
            pictures.map(async (picture) => {
              const [compressedUrl, thumbnailUrl, tags, counts, userLike, albums] =
                await Promise.all([
                  getSignedUrl(picture.compressed_r2_key),
                  getSignedUrl(picture.thumbnail_r2_key),
                  getPictureTags(picture.id),
                  getLikeCounts(picture.id),
                  getUserLike(user.id, picture.id),
                  getPictureAlbums(picture.id),
                ]);

              return {
                ...picture,
                compressed_url: compressedUrl,
                thumbnail_url: thumbnailUrl,
                tags,
                like_count: counts.likes,
                dislike_count: counts.dislikes,
                user_like: userLike,
                albums,
              };
            }),
          );

          return Response.json(enrichedPictures);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch feed", { status: 500 });
        }
      },
    },

    // Get timeline (user's pictures, chronological)
    "/api/timeline": {
      async GET(req) {
        try {
          const user = requireAuth(req);

          const url = new URL(req.url);
          const offset = parseInt(url.searchParams.get("offset") || "0");
          const limit = parseInt(url.searchParams.get("limit") || "20");
          const tagsParam = url.searchParams.get("tags");
          const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : undefined;

          const pictures = getTimeline(user.id, offset, limit, tags);

          const enrichedPictures = await Promise.all(
            pictures.map(async (picture) => {
              const [compressedUrl, thumbnailUrl, pictureTags, counts, userLike, albums] =
                await Promise.all([
                  getSignedUrl(picture.compressed_r2_key),
                  getSignedUrl(picture.thumbnail_r2_key),
                  getPictureTags(picture.id),
                  getLikeCounts(picture.id),
                  getUserLike(user.id, picture.id),
                  getPictureAlbums(picture.id),
                ]);

              return {
                ...picture,
                compressed_url: compressedUrl,
                thumbnail_url: thumbnailUrl,
                tags: pictureTags,
                like_count: counts.likes,
                dislike_count: counts.dislikes,
                user_like: userLike,
                albums,
              };
            }),
          );

          return Response.json(enrichedPictures);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch timeline", { status: 500 });
        }
      },
    },

    // Get all tags
    "/api/tags": {
      async GET(req) {
        try {
          requireAuth(req);
          const tags = getAllTags();
          return Response.json(tags);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch tags", { status: 500 });
        }
      },
    },

    // List all users with stats (must come before /api/users/:id)
    "/api/users": {
      async GET(req) {
        try {
          requireAuth(req);
          return Response.json(getUsersWithStats());
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch users", { status: 500 });
        }
      },
    },

    // Get albums for a user (must come before /api/users/:id)
    "/api/users/:id/albums": {
      async GET(req) {
        try {
          requireAuth(req);
          const userId = parseInt(req.params.id);
          const albums = getAlbumsByUser(userId);
          const enriched = await Promise.all(
            albums.map(async (album) => ({
              ...album,
              cover_thumbnail_url: album.cover_thumbnail_r2_key
                ? await getSignedUrl(album.cover_thumbnail_r2_key)
                : null,
              cover_thumbnail_r2_key: undefined,
            }))
          );
          return Response.json(enriched);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch albums", { status: 500 });
        }
      },
    },

    // Get cameras used by a user (must come before /api/users/:id)
    "/api/users/:id/cameras": {
      async GET(req) {
        try {
          requireAuth(req);
          const userId = parseInt(req.params.id);
          const cameras = getUserCameras(userId);
          return Response.json(cameras);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch cameras", { status: 500 });
        }
      },
    },

    // Get public user info
    "/api/users/:id": {
      async GET(req) {
        try {
          requireAuth(req);
          const userId = parseInt(req.params.id);
          const u = getUserById(userId);
          if (!u) return new Response("User not found", { status: 404 });
          return Response.json({ id: u.id, name: u.name, avatar_url: u.avatar_url });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch user", { status: 500 });
        }
      },
    },

    // Album CRUD
    "/api/albums": {
      async POST(req) {
        try {
          const user = requireAuth(req);
          const body = await req.json();
          const { title } = body;
          if (!title || typeof title !== "string" || !title.trim()) {
            return new Response("Album title is required", { status: 400 });
          }
          const album = createAlbum(user.id, title.trim());
          return Response.json(album);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to create album", { status: 500 });
        }
      },
    },

    "/api/albums/:id": {
      async GET(req) {
        try {
          requireAuth(req);
          const albumId = parseInt(req.params.id);
          const album = getAlbumById(albumId);
          if (!album) return new Response("Album not found", { status: 404 });
          return Response.json(album);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch album", { status: 500 });
        }
      },

      async PATCH(req) {
        try {
          const user = requireAuth(req);
          const albumId = parseInt(req.params.id);
          const album = getAlbumById(albumId);
          if (!album) return new Response("Album not found", { status: 404 });
          if (album.user_id !== user.id) return new Response("Forbidden", { status: 403 });

          const body = await req.json();
          const { title, coverPictureId } = body;
          updateAlbum(albumId, {
            title: typeof title === "string" ? title.trim() : undefined,
            coverPictureId: coverPictureId !== undefined ? coverPictureId : undefined,
          });
          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to update album", { status: 500 });
        }
      },

      async DELETE(req) {
        try {
          const user = requireAuth(req);
          const albumId = parseInt(req.params.id);
          const album = getAlbumById(albumId);
          if (!album) return new Response("Album not found", { status: 404 });
          if (album.user_id !== user.id) return new Response("Forbidden", { status: 403 });
          deleteAlbum(albumId);
          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to delete album", { status: 500 });
        }
      },
    },

    "/api/albums/:id/pictures": {
      async GET(req) {
        try {
          const user = requireAuth(req);
          const albumId = parseInt(req.params.id);
          const album = getAlbumById(albumId);
          if (!album) return new Response("Album not found", { status: 404 });

          const url = new URL(req.url);
          const offset = parseInt(url.searchParams.get("offset") || "0");
          const limit = parseInt(url.searchParams.get("limit") || "20");

          const pictures = getAlbumPictures(albumId, offset, limit);
          const enrichedPictures = await Promise.all(
            pictures.map(async (picture) => {
              const [compressedUrl, thumbnailUrl, tags, counts, userLike, albums] =
                await Promise.all([
                  getSignedUrl(picture.compressed_r2_key),
                  getSignedUrl(picture.thumbnail_r2_key),
                  getPictureTags(picture.id),
                  getLikeCounts(picture.id),
                  getUserLike(user.id, picture.id),
                  getPictureAlbums(picture.id),
                ]);
              return {
                ...picture,
                compressed_url: compressedUrl,
                thumbnail_url: thumbnailUrl,
                tags,
                like_count: counts.likes,
                dislike_count: counts.dislikes,
                user_like: userLike,
                albums,
              };
            }),
          );
          return Response.json(enrichedPictures);
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to fetch album pictures", { status: 500 });
        }
      },

      async POST(req) {
        try {
          const user = requireAuth(req);
          const albumId = parseInt(req.params.id);
          const album = getAlbumById(albumId);
          if (!album) return new Response("Album not found", { status: 404 });
          if (album.user_id !== user.id) return new Response("Forbidden", { status: 403 });

          const body = await req.json();
          const { pictureId } = body;
          if (!pictureId || typeof pictureId !== "number") {
            return new Response("pictureId is required", { status: 400 });
          }
          addPictureToAlbum(albumId, pictureId);
          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to add picture to album", { status: 500 });
        }
      },
    },

    "/api/albums/:id/pictures/:pictureId": {
      async DELETE(req) {
        try {
          const user = requireAuth(req);
          const albumId = parseInt(req.params.id);
          const pictureId = parseInt(req.params.pictureId);
          const album = getAlbumById(albumId);
          if (!album) return new Response("Album not found", { status: 404 });
          if (album.user_id !== user.id) return new Response("Forbidden", { status: 403 });
          removePictureFromAlbum(albumId, pictureId);
          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Failed to remove picture from album", { status: 500 });
        }
      },
    },

    // Google Photos Picker API
    "/api/google-photos/picker/session": {
      async POST(req) {
        try {
          const user = requireAuth(req);
          const accessToken = await getValidToken(user.id);
          const session = await createPickerSession(accessToken);
          return Response.json({ sessionId: session.id, pickerUri: session.pickerUri });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          const msg = error instanceof Error ? error.message : "Failed to create picker session";
          return new Response(msg, { status: 500 });
        }
      },
    },

    "/api/google-photos/thumbnail": {
      async GET(req) {
        try {
          const user = requireAuth(req);
          const url = new URL(req.url);
          const baseUrl = url.searchParams.get("url");
          const size = url.searchParams.get("size") ?? "w300-h300-c";

          if (!baseUrl || !baseUrl.startsWith("https://lh3.googleusercontent.com/")) {
            return new Response("Invalid url", { status: 400 });
          }

          const accessToken = await getValidToken(user.id);

          // Try with size param first, fall back to bare URL
          for (const fetchUrl of [`${baseUrl}=w300`, baseUrl]) {
            const response = await fetch(fetchUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            console.log(`Thumbnail fetch ${fetchUrl}: ${response.status}`);
            if (response.ok) {
              const contentType = response.headers.get("Content-Type") ?? "image/jpeg";
              return new Response(response.body, {
                headers: {
                  "Content-Type": contentType,
                  "Cache-Control": "private, max-age=3600",
                },
              });
            }
            const body = await response.text();
            console.error(`Thumbnail ${response.status}:`, body.slice(0, 200));
          }
          return new Response("Failed to fetch thumbnail", { status: 502 });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Thumbnail fetch failed", { status: 500 });
        }
      },
    },

    "/api/google-photos/picker/session/:id": {
      async GET(req) {
        try {
          const user = requireAuth(req);
          const accessToken = await getValidToken(user.id);
          const session = await getPickerSession(accessToken, req.params.id);

          if (!session.mediaItemsSet) {
            return Response.json({ ready: false });
          }

          const items = await listPickerMediaItems(accessToken, req.params.id);
          return Response.json({ ready: true, items });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          const msg = error instanceof Error ? error.message : "Failed to poll session";
          return new Response(msg, { status: 500 });
        }
      },
    },

    "/api/google-photos/import": {
      async POST(req) {
        try {
          const user = requireAuth(req);
          const body = await req.json() as { sessionId: string; description?: string; frame?: string; excludeIds?: string[] };
          const { sessionId, description, frame: frameParam, excludeIds } = body;
          const VALID_FRAMES_GP = ['none', 'white', 'polaroid', 'dark', 'film'];
          const frame = frameParam && VALID_FRAMES_GP.includes(frameParam) ? frameParam : 'none';

          if (!sessionId) {
            return new Response("sessionId required", { status: 400 });
          }

          const accessToken = await getValidToken(user.id);
          const allItems = await listPickerMediaItems(accessToken, sessionId);
          const excludeSet = new Set(excludeIds ?? []);
          const items = allItems.filter(i => !excludeSet.has(i.id));
          const imported: number[] = [];

          for (const item of items) {
            if (!item.mediaFile.mimeType.startsWith("image/")) continue;

            const fileBuffer = await downloadMediaItem(item.mediaFile.baseUrl, accessToken);
            const { original, compressed, thumbnail, metadata } = await compressImage(fileBuffer);

            const originalKey = generatePictureKey(user.id, item.mediaFile.filename, "original");
            const compressedKey = generatePictureKey(user.id, item.mediaFile.filename, "compressed");
            const thumbnailKey = generatePictureKey(user.id, item.mediaFile.filename, "thumbnail");

            await Promise.all([
              uploadToR2(originalKey, original, item.mediaFile.mimeType),
              uploadToR2(compressedKey, compressed, "image/jpeg"),
              uploadToR2(thumbnailKey, thumbnail, "image/webp"),
            ]);

            const photoMeta = item.mediaFile.mediaFileMetadata?.photoMetadata;

            // Parse Google's exposure time format ("0.000846605s" → "1/1182s")
            let exposureTime: string | null = metadata.cameraInfo.exposureTime;
            if (!exposureTime && photoMeta?.exposureTime) {
              const secs = parseFloat(photoMeta.exposureTime);
              if (!isNaN(secs) && secs > 0) {
                exposureTime = secs < 1 ? `1/${Math.round(1 / secs)}s` : `${secs}s`;
              }
            }

            const picture = uploadPicture({
              userId: user.id,
              originalKey,
              compressedKey,
              thumbnailKey,
              originalFilename: item.mediaFile.filename,
              originalSize: metadata.originalSize,
              compressedSize: metadata.compressedSize,
              width: metadata.width,
              height: metadata.height,
              mimeType: item.mediaFile.mimeType,
              description: description || undefined,
              frame,
              cameraMake: metadata.cameraInfo.cameraMake ?? photoMeta?.cameraMake ?? null,
              cameraModel: metadata.cameraInfo.cameraModel ?? photoMeta?.cameraModel ?? null,
              lensModel: metadata.cameraInfo.lensModel,
              fNumber: metadata.cameraInfo.fNumber ?? photoMeta?.apertureFNumber ?? null,
              exposureTime,
              iso: metadata.cameraInfo.iso ?? photoMeta?.isoEquivalent ?? null,
              focalLength: metadata.cameraInfo.focalLength ?? photoMeta?.focalLength ?? null,
              takenAt: metadata.cameraInfo.takenAt ?? (item.createTime ? new Date(item.createTime).toISOString() : null),
            });

            imported.push(picture.id);
          }

          // Clean up the picker session
          await deletePickerSession(accessToken, sessionId).catch(() => {});

          return Response.json({ imported: imported.length, ids: imported });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          const msg = error instanceof Error ? error.message : "Import failed";
          return new Response(msg, { status: 500 });
        }
      },
    },

    // Manual backup trigger (admin only)
    "/api/backup": {
      async POST(req) {
        try {
          const user = requireAuth(req);

          // Check if user is admin (first email in whitelist)
          const adminEmail = process.env.ALLOWED_EMAILS!.split(",")[0]?.trim();
          if (user.email !== adminEmail) {
            return new Response("Forbidden", { status: 403 });
          }

          await backupDatabase();
          return Response.json({ success: true, message: "Backup completed" });
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response("Backup failed", { status: 500 });
        }
      },
    },
  },

});

console.log(`🚀 Server running at http://localhost:${PORT}`);
