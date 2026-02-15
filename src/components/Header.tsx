import React from "react";
import type { User } from "../types";
import type { View } from "../App";

interface HeaderProps {
  user: User;
  view: View;
  setView: (view: View) => void;
}

export function Header({ user, view, setView }: HeaderProps) {
  const handleLogout = async () => {
    await fetch("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  return (
    <header className="bg-zinc-900 border-b border-zinc-800">
      <div className="container mx-auto px-6 py-5 max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-tight text-zinc-50">Frames</h1>

          <nav className="flex items-center gap-2">
            <button
              onClick={() => setView("feed")}
              className={`px-5 py-2 rounded-lg font-normal text-sm transition-all ${
                view === "feed"
                  ? "bg-zinc-800 text-zinc-50 border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              Feed
            </button>

            <button
              onClick={() => setView("timeline")}
              className={`px-5 py-2 rounded-lg font-normal text-sm transition-all ${
                view === "timeline"
                  ? "bg-zinc-800 text-zinc-50 border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              Timeline
            </button>

            <button
              onClick={() => setView("upload")}
              className={`px-5 py-2 rounded-lg font-normal text-sm transition-all ${
                view === "upload"
                  ? "bg-zinc-800 text-zinc-50 border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              Upload
            </button>

            <div className="flex items-center gap-3 ml-6 pl-6 border-l border-zinc-800">
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full ring-1 ring-zinc-700"
                />
              )}
              <span className="text-sm text-zinc-300 font-light">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-zinc-500 hover:text-zinc-300 font-light transition-colors"
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
