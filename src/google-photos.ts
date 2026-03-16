import { getGoogleTokens, storeGoogleTokens } from "./db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const BASE_URL = "https://photoslibrary.googleapis.com/v1";

export interface GooglePhotosAlbum {
  id: string;
  title: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: string;
}

export interface GooglePhotosMediaItem {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    width: string;
    height: string;
    creationTime: string;
    photo?: {
      cameraMake?: string;
      cameraModel?: string;
      focalLength?: number;
      apertureFNumber?: number;
      isoEquivalent?: number;
      exposureTime?: string;
    };
  };
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google access token");
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getValidToken(userId: number): Promise<string> {
  const tokens = getGoogleTokens(userId);

  if (!tokens?.google_access_token) {
    throw new Error("No Google Photos access token. Please sign in again.");
  }

  // Refresh if expiring within 5 minutes
  const expiresAt = tokens.google_token_expires_at
    ? new Date(tokens.google_token_expires_at)
    : new Date(0);
  const fiveMinutes = 5 * 60 * 1000;

  if (Date.now() >= expiresAt.getTime() - fiveMinutes) {
    if (!tokens.google_refresh_token) {
      throw new Error("Google Photos token expired. Please sign in again.");
    }
    const refreshed = await refreshAccessToken(tokens.google_refresh_token);
    storeGoogleTokens(userId, refreshed.accessToken, null, refreshed.expiresAt);
    return refreshed.accessToken;
  }

  return tokens.google_access_token;
}

export async function listAlbums(accessToken: string): Promise<GooglePhotosAlbum[]> {
  const albums: GooglePhotosAlbum[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "50" });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${BASE_URL}/albums?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Google Photos albums error ${response.status}:`, body);
      throw new Error(`Google Photos albums error: ${response.status} — ${body}`);
    }

    const data = (await response.json()) as { albums?: GooglePhotosAlbum[]; nextPageToken?: string };
    if (data.albums) albums.push(...data.albums);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return albums;
}

export async function listMediaItems(
  accessToken: string,
  albumId?: string,
  pageToken?: string,
): Promise<{ items: GooglePhotosMediaItem[]; nextPageToken?: string }> {
  if (albumId) {
    const body: Record<string, unknown> = { albumId, pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(`${BASE_URL}/mediaItems:search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Google Photos media error: ${response.status}`);
    }

    const data = (await response.json()) as { mediaItems?: GooglePhotosMediaItem[]; nextPageToken?: string };
    return { items: data.mediaItems ?? [], nextPageToken: data.nextPageToken };
  }

  // All photos
  const params = new URLSearchParams({ pageSize: "100" });
  if (pageToken) params.set("pageToken", pageToken);

  const response = await fetch(`${BASE_URL}/mediaItems?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Photos media error: ${response.status}`);
  }

  const data = (await response.json()) as { mediaItems?: GooglePhotosMediaItem[]; nextPageToken?: string };
  return { items: data.mediaItems ?? [], nextPageToken: data.nextPageToken };
}

export async function batchGetMediaItems(
  accessToken: string,
  mediaItemIds: string[],
): Promise<GooglePhotosMediaItem[]> {
  const params = new URLSearchParams();
  for (const id of mediaItemIds) params.append("mediaItemIds", id);

  const response = await fetch(`${BASE_URL}/mediaItems:batchGet?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Photos batchGet error: ${response.status}`);
  }

  const data = (await response.json()) as {
    mediaItemResults: Array<{ mediaItem?: GooglePhotosMediaItem; status?: { message: string } }>;
  };

  return data.mediaItemResults
    .filter((r) => r.mediaItem)
    .map((r) => r.mediaItem!);
}

export async function downloadMediaItem(baseUrl: string): Promise<Buffer> {
  // Append =d to get the original download
  const response = await fetch(`${baseUrl}=d`);

  if (!response.ok) {
    throw new Error(`Failed to download media item: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
