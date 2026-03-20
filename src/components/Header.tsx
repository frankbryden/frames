import React from "react";
import type { User } from "../types";
import type { View } from "../App";

interface HeaderProps {
  user: User;
  view: View;
  setView: (view: View) => void;
  onProfileClick: () => void;
}

export function Header({ user, view, setView, onProfileClick }: HeaderProps) {
  const handleLogout = async () => {
    await fetch("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="container mx-auto px-6 py-5 max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extralight tracking-widest text-slate-900">Frames</h1>

          <nav className="flex items-center gap-2">
            {(["feed", "timeline", "upload", "import"] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-5 py-2 rounded-lg font-normal text-sm transition-all capitalize ${
                  view === v
                    ? "bg-slate-100 text-slate-900 border border-slate-200"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {v}
              </button>
            ))}

            <div className="flex items-center gap-3 ml-6 pl-6 border-l border-slate-200">
              <button
                onClick={onProfileClick}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                {user.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-8 h-8 rounded-full ring-1 ring-slate-200"
                  />
                )}
                <span className="text-sm text-slate-700 font-light">{user.name}</span>
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-400 hover:text-slate-700 font-light transition-colors"
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
