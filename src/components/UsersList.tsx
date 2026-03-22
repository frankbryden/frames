import React, { useState, useEffect } from "react";
import type { UserWithStats } from "../types";

interface UsersListProps {
  onUserClick: (userId: number) => void;
}

export function UsersList({ onUserClick }: UsersListProps) {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-slate-400 font-light">Loading...</div>;
  }

  if (users.length === 0) {
    return <div className="text-center py-20 text-slate-400 font-light">No users found.</div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        {users.map((user, i) => (
          <button
            key={user.id}
            onClick={() => onUserClick(user.id)}
            className={`w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left ${
              i > 0 ? "border-t border-slate-100" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full ring-1 ring-slate-200 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
              )}
              <span className="text-sm font-light text-slate-800">{user.name}</span>
            </div>
            <div className="text-xs text-slate-400 font-light">
              {user.photo_count} {user.photo_count === 1 ? "photo" : "photos"}
              <span className="mx-2">·</span>
              {user.album_count} {user.album_count === 1 ? "album" : "albums"}
              <span className="mx-2">·</span>
              {user.camera_count} {user.camera_count === 1 ? "camera" : "cameras"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
