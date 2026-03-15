import React, { useState, useEffect } from "react";
import type { User, CameraInfo } from "../types";

interface UserProfileProps {
  userId: number;
  currentUser: User;
  onBack: () => void;
}

export function UserProfile({ userId, currentUser, onBack }: UserProfileProps) {
  const [profileUser, setProfileUser] = useState<{ id: number; name: string; avatar_url: string | null } | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const [userRes, camerasRes] = await Promise.all([
          fetch(`/api/users/${userId}`, { credentials: "include" }),
          fetch(`/api/users/${userId}/cameras`, { credentials: "include" }),
        ]);
        if (userRes.ok) setProfileUser(await userRes.json());
        if (camerasRes.ok) setCameras(await camerasRes.json());
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [userId]);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-8 text-sm text-zinc-400 hover:text-zinc-200 font-light transition-colors flex items-center gap-2"
      >
        ← Back
      </button>

      {loading ? (
        <div className="text-zinc-500 font-light">Loading...</div>
      ) : profileUser ? (
        <>
          <div className="flex items-center gap-4 mb-10">
            {profileUser.avatar_url && (
              <img
                src={profileUser.avatar_url}
                alt={profileUser.name}
                className="w-16 h-16 rounded-full ring-1 ring-zinc-700"
              />
            )}
            <div>
              <h2 className="text-2xl font-light text-zinc-50">{profileUser.name}</h2>
              {userId === currentUser.id && (
                <p className="text-sm text-zinc-500 font-light mt-1">Your profile</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-normal text-zinc-500 uppercase tracking-widest mb-4">
              Cameras
            </h3>
            {cameras.length === 0 ? (
              <p className="text-zinc-600 font-light text-sm">No camera info found in uploaded photos.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cameras.map((cam, i) => (
                  <div
                    key={i}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
                  >
                    <p className="text-zinc-100 font-light">
                      {[cam.camera_make, cam.camera_model].filter(Boolean).join(" ") || "Unknown Camera"}
                    </p>
                    <p className="text-zinc-500 text-xs font-light mt-1">
                      {cam.photo_count} {cam.photo_count === 1 ? "photo" : "photos"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-zinc-500 font-light">User not found.</p>
      )}
    </div>
  );
}
