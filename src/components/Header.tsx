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
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Photo Share</h1>

          <nav className="flex items-center gap-4">
            <button
              onClick={() => setView("feed")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === "feed"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Feed
            </button>

            <button
              onClick={() => setView("timeline")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === "timeline"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              My Timeline
            </button>

            <button
              onClick={() => setView("upload")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === "upload"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Upload
            </button>

            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm text-gray-700">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
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
