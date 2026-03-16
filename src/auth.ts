import {
  getUserByGoogleId,
  createUser,
  updateUserLogin,
  createSession,
  validateSession,
} from "./db";
import type { User } from "./types";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const ALLOWED_EMAILS = process.env
  .ALLOWED_EMAILS!.split(",")
  .map((e) => e.trim());
const SESSION_SECRET = process.env.SESSION_SECRET!;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email);
}

export function generateGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/photoslibrary.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export async function exchangeCodeForToken(code: string): Promise<GoogleTokens> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange code for token");
  }

  const data = (await response.json()) as GoogleTokenResponse;
  console.log("OAuth token exchange — granted scopes:", data.scope);
  console.log("OAuth token exchange — refresh_token present:", !!data.refresh_token);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
  };
}

export async function getGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to get user info from Google");
  }

  return (await response.json()) as GoogleUserInfo;
}

export function createOrUpdateUser(userInfo: GoogleUserInfo): User {
  let user = getUserByGoogleId(userInfo.id);

  console.log(`Got user with info ${user}`);
  console.log(`Original user info is ${JSON.stringify(userInfo)}`);

  if (user) {
    updateUserLogin(user.id);
    return user;
  }

  // Create new user
  user = createUser(
    userInfo.id,
    userInfo.email,
    userInfo.name,
    userInfo.picture,
  );
  return user;
}

export function getUserFromSession(req: Request): User | null {
  const cookieHeader = req.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [key, ...values] = c.split("=");
      return [key, values.join("=")];
    }),
  );

  const sessionId = cookies.session;
  if (!sessionId) return null;

  return validateSession(sessionId);
}

export function createSessionCookie(sessionId: string): string {
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  const secure = IS_PRODUCTION ? "; Secure" : "";
  return `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = IS_PRODUCTION ? "; Secure" : "";
  return `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function generateState(): string {
  return crypto.randomUUID();
}
