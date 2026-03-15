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

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("feed");
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const handleUserClick = (userId: number) => {
    setProfileUserId(userId);
    setView("profile");
  };

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
        setView={setView}
        onProfileClick={() => { setProfileUserId(user.id); setView("profile"); }}
      />
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {view === "feed" && <UserFeed user={user} onUserClick={handleUserClick} />}
        {view === "timeline" && <Timeline user={user} onUserClick={handleUserClick} />}
        {view === "upload" && <UploadForm onUploadComplete={() => setView("timeline")} />}
        {view === "import" && <GooglePhotosImport onImportComplete={() => setView("timeline")} />}
        {view === "profile" && profileUserId !== null && (
          <UserProfile userId={profileUserId} currentUser={user} onBack={() => setView("feed")} />
        )}
      </main>
    </div>
  );
}
