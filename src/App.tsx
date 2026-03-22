import React, { useState, useEffect } from "react";
import { LoginButton } from "./components/LoginButton";
import { Header } from "./components/Header";
import { UserFeed } from "./components/UserFeed";
import { Timeline } from "./components/Timeline";
import { UploadForm } from "./components/UploadForm";
import { UserProfile } from "./components/UserProfile";
import { GooglePhotosImport } from "./components/GooglePhotosImport";
import { AlbumView } from "./components/AlbumView";
import { UsersList } from "./components/UsersList";
import type { User } from "./types";

export type View = "feed" | "timeline" | "upload" | "profile" | "import" | "album" | "users";

function parsePathToView(pathname: string): { view: View; profileUserId: number | null; albumId: number | null } {
  if (pathname === "/timeline") return { view: "timeline", profileUserId: null, albumId: null };
  if (pathname === "/upload") return { view: "upload", profileUserId: null, albumId: null };
  if (pathname === "/import") return { view: "import", profileUserId: null, albumId: null };
  if (pathname === "/users") return { view: "users", profileUserId: null, albumId: null };
  const profileMatch = pathname.match(/^\/profile\/(\d+)$/);
  if (profileMatch) return { view: "profile", profileUserId: parseInt(profileMatch[1]), albumId: null };
  const albumMatch = pathname.match(/^\/albums\/(\d+)$/);
  if (albumMatch) return { view: "album", profileUserId: null, albumId: parseInt(albumMatch[1]) };
  return { view: "feed", profileUserId: null, albumId: null };
}

function viewToPath(view: View, profileUserId?: number | null, albumId?: number | null): string {
  if (view === "profile" && profileUserId) return `/profile/${profileUserId}`;
  if (view === "album" && albumId) return `/albums/${albumId}`;
  if (view === "users") return "/users";
  if (view === "feed") return "/feed";
  return `/${view}`;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const initial = parsePathToView(window.location.pathname);
  const [view, setViewState] = useState<View>(initial.view);
  const [profileUserId, setProfileUserId] = useState<number | null>(initial.profileUserId);
  const [albumId, setAlbumId] = useState<number | null>(initial.albumId);
  const [loading, setLoading] = useState(true);

  const navigate = (newView: View, newProfileUserId?: number | null, newAlbumId?: number | null) => {
    const userId = newProfileUserId !== undefined ? newProfileUserId : (newView === "profile" ? profileUserId : null);
    const aId = newAlbumId !== undefined ? newAlbumId : (newView === "album" ? albumId : null);
    history.pushState(null, "", viewToPath(newView, userId, aId));
    setViewState(newView);
    if (newProfileUserId !== undefined) setProfileUserId(newProfileUserId);
    if (newAlbumId !== undefined) setAlbumId(newAlbumId);
  };

  const handleUserClick = (userId: number) => {
    navigate("profile", userId);
  };

  const handleAlbumClick = (id: number) => {
    navigate("album", null, id);
  };

  useEffect(() => {
    const handlePopState = () => {
      const { view, profileUserId, albumId } = parsePathToView(window.location.pathname);
      setViewState(view);
      setProfileUserId(profileUserId);
      setAlbumId(albumId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    fetch("/api/me", {
      credentials: "include",
    })
      .then(res => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500 font-light">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginButton />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header
        user={user}
        view={view}
        setView={(v) => navigate(v)}
        onProfileClick={() => navigate("profile", user.id)}
      />
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {view === "feed" && <UserFeed user={user} onUserClick={handleUserClick} onAlbumClick={handleAlbumClick} />}
        {view === "timeline" && <Timeline user={user} onUserClick={handleUserClick} onAlbumClick={handleAlbumClick} />}
        {view === "upload" && <UploadForm onUploadComplete={() => navigate("timeline")} />}
        {view === "import" && <GooglePhotosImport onImportComplete={() => navigate("timeline")} />}
        {view === "profile" && profileUserId !== null && (
          <UserProfile userId={profileUserId} currentUser={user} onBack={() => navigate("feed")} onAlbumClick={handleAlbumClick} />
        )}
        {view === "users" && <UsersList onUserClick={handleUserClick} />}
        {view === "album" && albumId !== null && (
          <AlbumView albumId={albumId} currentUser={user} onBack={() => navigate("feed")} onUserClick={handleUserClick} onAlbumClick={handleAlbumClick} />
        )}
      </main>
    </div>
  );
}
