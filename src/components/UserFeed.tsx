import React, { useState, useEffect } from "react";
import { PictureCard } from "./PictureCard";
import type { User, Picture } from "../types";

interface UserFeedProps {
  user: User;
}

export function UserFeed({ user }: UserFeedProps) {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPictures = async (reset: boolean = false) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;

      const res = await fetch(`/api/feed?offset=${currentOffset}&limit=20`, {
        credentials: "include",
      });

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

  useEffect(() => {
    loadPictures(true);
  }, []);

  const handleUpdate = () => {
    loadPictures(true);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Feed</h2>

      {loading && pictures.length === 0 ? (
        <div className="text-center py-12 text-gray-600">Loading...</div>
      ) : pictures.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          No pictures yet. Upload your first photo!
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pictures.map(picture => (
              <PictureCard
                key={picture.id}
                picture={picture}
                currentUser={user}
                onUpdate={handleUpdate}
              />
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={() => loadPictures(false)}
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
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
