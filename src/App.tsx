import React, { useState, useEffect } from "react";
import { LoginButton } from "./components/LoginButton";
import { Header } from "./components/Header";
import { UserFeed } from "./components/UserFeed";
import { Timeline } from "./components/Timeline";
import { UploadForm } from "./components/UploadForm";
import { UserProfile } from "./components/UserProfile";
import { GooglePhotosImport } from "./components/GooglePhotosImport";
import type { User } from "./types";

export type View = "feed" | "timeline" | "upload" | "profile" | "import";

function parsePathToView(pathname: string): { view: View; profileUserId: number | null } {
  if (pathname === "/timeline") return { view: "timeline", profileUserId: null };
  if (pathname === "/upload") return { view: "upload", profileUserId: null };
  if (pathname === "/import") return { view: "import", profileUserId: null };
  const profileMatch = pathname.match(/^\/profile\/(\d+)$/);
  if (profileMatch) return { view: "profile", profileUserId: parseInt(profileMatch[1]) };
  return { view: "feed", profileUserId: null };
}

function viewToPath(view: View, profileUserId?: number | null): string {
  if (view === "profile" && profileUserId) return `/profile/${profileUserId}`;
  if (view === "feed") return "/feed";
  return `/${view}`;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const initial = parsePathToView(window.location.pathname);
  const [view, setViewState] = useState<View>(initial.view);
  const [profileUserId, setProfileUserId] = useState<number | null>(initial.profileUserId);
  const [loading, setLoading] = useState(true);

  const navigate = (newView: View, newProfileUserId?: number | null) => {
    const userId = newProfileUserId !== undefined ? newProfileUserId : (newView === "profile" ? profileUserId : null);
    history.pushState(null, "", viewToPath(newView, userId));
    setViewState(newView);
    if (newProfileUserId !== undefined) setProfileUserId(newProfileUserId);
  };

  const handleUserClick = (userId: number) => {
    navigate("profile", userId);
  };

  useEffect(() => {
    const handlePopState = () => {
      const { view, profileUserId } = parsePathToView(window.location.pathname);
      setViewState(view);
      setProfileUserId(profileUserId);
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-400 font-light">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginButton />;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        user={user}
        view={view}
        setView={(v) => navigate(v)}
        onProfileClick={() => navigate("profile", user.id)}
      />
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {view === "feed" && <UserFeed user={user} onUserClick={handleUserClick} />}
        {view === "timeline" && <Timeline user={user} onUserClick={handleUserClick} />}
        {view === "upload" && <UploadForm onUploadComplete={() => navigate("timeline")} />}
        {view === "import" && <GooglePhotosImport onImportComplete={() => navigate("timeline")} />}
        {view === "profile" && profileUserId !== null && (
          <UserProfile userId={profileUserId} currentUser={user} onBack={() => navigate("feed")} />
        )}
      </main>
    </div>
  );
}
