import { getGoogleTokens, storeGoogleTokens } from "./db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const PICKER_BASE_URL = "https://photospicker.googleapis.com/v1";

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  expireTime: string;
  pollingConfig?: {
    pollInterval: string; // e.g. "5s"
    timeoutIn: string;
  };
}

export interface PickerMediaItem {
  id: string;
  createTime: string;
  type: string;
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
    mediaFileMetadata?: {
      width?: number;
      height?: number;
      photoMetadata?: {
        cameraMake?: string;
        cameraModel?: string;
        focalLength?: number;
        apertureFNumber?: number;
        isoEquivalent?: number;
        exposureTime?: string;
      };
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

export async function createPickerSession(accessToken: string): Promise<PickerSession> {
  const response = await fetch(`${PICKER_BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Picker createSession error ${response.status}:`, body);
    throw new Error(`Failed to create picker session: ${response.status} — ${body}`);
  }

  return (await response.json()) as PickerSession;
}

export async function getPickerSession(
  accessToken: string,
  sessionId: string,
): Promise<PickerSession> {
  const response = await fetch(`${PICKER_BASE_URL}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to get picker session: ${response.status} — ${body}`);
  }

  return (await response.json()) as PickerSession;
}

export async function listPickerMediaItems(
  accessToken: string,
  sessionId: string,
): Promise<PickerMediaItem[]> {
  const items: PickerMediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ sessionId, pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${PICKER_BASE_URL}/mediaItems?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to list picker media items: ${response.status} — ${body}`);
    }

    const data = (await response.json()) as {
      mediaItems?: PickerMediaItem[];
      nextPageToken?: string;
    };
    if (data.mediaItems) items.push(...data.mediaItems);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export async function deletePickerSession(
  accessToken: string,
  sessionId: string,
): Promise<void> {
  await fetch(`${PICKER_BASE_URL}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function downloadMediaItem(baseUrl: string, accessToken: string): Promise<Buffer> {
  // Try =d (original quality) first, fall back to bare URL
  for (const fetchUrl of [`${baseUrl}=d`, baseUrl]) {
    const response = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log(`Download ${fetchUrl}: ${response.status}`);
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }
    const body = await response.text();
    console.error(`Download ${response.status}:`, body.slice(0, 200));
  }
  throw new Error("Failed to download media item after retries");
}
