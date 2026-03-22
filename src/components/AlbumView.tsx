import React, { useState, useEffect } from "react";
import type { Album, Picture, User } from "../types";
import { PictureCard } from "./PictureCard";

interface AlbumViewProps {
  albumId: number;
  currentUser: User;
  onBack: () => void;
  onUserClick: (userId: number) => void;
  onAlbumClick: (albumId: number) => void;
}

export function AlbumView({ albumId, currentUser, onBack, onUserClick, onAlbumClick }: AlbumViewProps) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  const loadAlbum = async () => {
    try {
      const res = await fetch(`/api/albums/${albumId}`, { credentials: "include" });
      if (res.ok) {
        const a = await res.json();
        setAlbum(a);
        setTitleInput(a.title);
      }
    } catch (err) {
      console.error("Failed to load album:", err);
    }
  };

  const loadPictures = async (reset: boolean = false) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      const res = await fetch(`/api/albums/${albumId}/pictures?offset=${currentOffset}&limit=20`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPictures(prev => reset ? data : [...prev, ...data]);
        setOffset(currentOffset + data.length);
        setHasMore(data.length === 20);
      }
    } catch (err) {
      console.error("Failed to load album pictures:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlbum();
    loadPictures(true);
  }, [albumId]);

  const handleSaveTitle = async () => {
    if (!titleInput.trim() || titleInput.trim() === album?.title) {
      setEditingTitle(false);
      return;
    }
    try {
      const res = await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleInput.trim() }),
      });
      if (res.ok) {
        setAlbum(prev => prev ? { ...prev, title: titleInput.trim() } : prev);
      }
    } catch (err) {
      console.error("Failed to update album title:", err);
    } finally {
      setEditingTitle(false);
    }
  };

  const handleSetCover = async (pictureId: number) => {
    try {
      await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverPictureId: pictureId }),
      });
      setAlbum(prev => prev ? { ...prev, cover_picture_id: pictureId } : prev);
    } catch (err) {
      console.error("Failed to set cover:", err);
    }
  };

  const isOwner = album?.user_id === currentUser.id;

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-8 text-sm text-slate-400 hover:text-slate-700 font-light transition-colors flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="mb-8 flex items-center gap-3">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleInput(album?.title || ""); } }}
              className="font-album-title text-2xl bg-transparent border-b border-slate-400 focus:outline-none focus:border-slate-700 text-slate-900"
            />
            <button
              onClick={handleSaveTitle}
              className="text-sm text-slate-600 hover:text-slate-900 font-light transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEditingTitle(false); setTitleInput(album?.title || ""); }}
              className="text-sm text-slate-400 hover:text-slate-600 font-light transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h1 className="font-album-title text-2xl text-slate-900">{album?.title}</h1>
            {isOwner && (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Edit title"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {loading && pictures.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-light">Loading...</div>
      ) : pictures.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-light">No photos in this album yet.</div>
      ) : (
        <>
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
            {pictures.map(picture => (
              <div key={picture.id} className="break-inside-avoid mb-6">
                <PictureCard
                  picture={picture}
                  currentUser={currentUser}
                  onUpdate={() => loadPictures(true)}
                  onUserClick={onUserClick}
                  onAlbumClick={onAlbumClick}
                  onSetCover={isOwner ? handleSetCover : undefined}
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
