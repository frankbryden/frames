import React, { useState, useEffect } from "react";
import { LoginButton } from "./components/LoginButton";
import { Header } from "./components/Header";
import { UserFeed } from "./components/UserFeed";
import { Timeline } from "./components/Timeline";
import { UploadForm } from "./components/UploadForm";
import type { User } from "./types";

export type View = "feed" | "timeline" | "upload";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("feed");
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginButton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} view={view} setView={setView} />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {view === "feed" && <UserFeed user={user} />}
        {view === "timeline" && <Timeline user={user} />}
        {view === "upload" && <UploadForm onUploadComplete={() => setView("timeline")} />}
      </main>
    </div>
  );
}
