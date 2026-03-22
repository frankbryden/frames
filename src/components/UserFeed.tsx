import React, { useState, useEffect } from "react";
import { PictureCard } from "./PictureCard";
import type { User, Picture } from "../types";

interface UserFeedProps {
  user: User;
  onUserClick: (userId: number) => void;
  onAlbumClick?: (albumId: number) => void;
}

export function UserFeed({ user, onUserClick, onAlbumClick }: UserFeedProps) {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPictures = async (reset: boolean = false) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      const res = await fetch(`/api/feed?offset=${currentOffset}&limit=20`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPictures(prev => (reset ? data : [...prev, ...data]));
        setOffset(currentOffset + data.length);
        setHasMore(data.length === 20);
      }
    } catch (error) {
      console.error("Failed to load feed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPictures(true); }, []);

  return (
    <div>
      {loading && pictures.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-light">Loading...</div>
      ) : pictures.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-light">No pictures yet. Upload your first photo!</div>
      ) : (
        <>
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
            {pictures.map(picture => (
              <div key={picture.id} className="break-inside-avoid mb-6">
                <PictureCard
                  picture={picture}
                  currentUser={user}
                  onUpdate={() => loadPictures(true)}
                  onUserClick={onUserClick}
                  onAlbumClick={onAlbumClick}
                />
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={() => loadPictures(false)}
                disabled={loading}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 font-light transition-all shadow-sm"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
