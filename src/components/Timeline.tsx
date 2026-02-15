import React, { useState, useEffect } from "react";
import { PictureCard } from "./PictureCard";
import { TagFilter } from "./TagFilter";
import type { User, Picture, Tag } from "../types";

interface TimelineProps {
  user: User;
}

export function Timeline({ user }: TimelineProps) {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadTags = async () => {
    try {
      const res = await fetch("/api/tags", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAllTags(data);
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  const loadPictures = async (reset: boolean = false) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;

      const tagsParam = selectedTags.length > 0 ? `&tags=${selectedTags.join(",")}` : "";
      const res = await fetch(
        `/api/timeline?offset=${currentOffset}&limit=20${tagsParam}`,
        { credentials: "include" }
      );

      if (res.ok) {
        const data = await res.json();
        setPictures(prev => (reset ? data : [...prev, ...data]));
        setOffset(currentOffset + data.length);
        setHasMore(data.length === 20);
      }
    } catch (error) {
      console.error("Failed to load timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadPictures(true);
  }, [selectedTags]);

  const handleUpdate = () => {
    loadPictures(true);
    loadTags();
  };

  return (
    <div className="flex gap-6">
      <aside className="w-64 flex-shrink-0">
        <TagFilter
          tags={allTags}
          selectedTags={selectedTags}
          onSelectTags={setSelectedTags}
        />
      </aside>

      <div className="flex-1">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">My Timeline</h2>

        {loading && pictures.length === 0 ? (
          <div className="text-center py-12 text-gray-600">Loading...</div>
        ) : pictures.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            {selectedTags.length > 0
              ? "No pictures found with selected tags."
              : "No pictures yet. Upload your first photo!"}
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
    </div>
  );
}
