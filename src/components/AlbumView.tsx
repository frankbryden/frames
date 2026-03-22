import React, { useState, useEffect, useCallback } from "react";
import type { Album, Picture, User } from "../types";
import { PictureCard } from "./PictureCard";

interface AddPicturesModalProps {
  albumId: number;
  userId: number;
  alreadyInAlbum: Set<number>;
  onClose: () => void;
  onAdded: () => void;
}

function AddPicturesModal({ albumId, userId, alreadyInAlbum, onClose, onAdded }: AddPicturesModalProps) {
  const [allPictures, setAllPictures] = useState<Picture[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadMore = useCallback(async (currentOffset: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pictures?userId=${userId}&offset=${currentOffset}&limit=40`, { credentials: "include" });
      if (res.ok) {
        const data: Picture[] = await res.json();
        setAllPictures(prev => currentOffset === 0 ? data : [...prev, ...data]);
        setOffset(currentOffset + data.length);
        setHasMore(data.length === 40);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadMore(0); }, [loadMore]);

  const available = allPictures.filter(p => !alreadyInAlbum.has(p.id));

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...selected].map(pictureId =>
        fetch(`/api/albums/${albumId}/pictures`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pictureId }),
        })
      ));
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-light text-slate-800">Add pictures to album</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {available.length === 0 && !loading ? (
            <p className="text-center text-slate-400 font-light py-10">All your photos are already in this album.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {available.map(picture => {
                  const isSelected = selected.has(picture.id);
                  return (
                    <button
                      key={picture.id}
                      onClick={() => toggle(picture.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden focus:outline-none transition-all ${
                        isSelected ? "ring-2 ring-slate-700 ring-offset-1" : "hover:opacity-90"
                      }`}
                    >
                      <img
                        src={picture.thumbnail_url || ""}
                        alt={picture.description || ""}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                            <svg className="w-4 h-4 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {hasMore && (
                <div className="text-center mt-4">
                  <button
                    onClick={() => loadMore(offset)}
                    disabled={loading}
                    className="text-sm text-slate-400 hover:text-slate-600 font-light transition-colors disabled:opacity-50"
                  >
                    {loading ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 flex-shrink-0">
          <span className="text-sm text-slate-400 font-light">
            {selected.size > 0 ? `${selected.size} selected` : "Click photos to select"}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-light transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || saving}
              className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-40 font-light transition-colors"
            >
              {saving ? "Adding..." : `Add ${selected.size > 0 ? selected.size : ""} photo${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [showAddModal, setShowAddModal] = useState(false);

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

  const handleSetCover = async (pictureId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverPictureId: pictureId }),
      });
      if (res.ok) {
        setAlbum(prev => prev ? { ...prev, cover_picture_id: pictureId } : prev);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to set cover:", err);
      return false;
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

      <div className="mb-8 flex items-center gap-3 justify-between">
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
            <div className="flex items-center gap-3">
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
            </div>
            {isOwner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="text-slate-400 hover:text-slate-700 font-bold text-2xl leading-none transition-colors"
                title="Add pictures"
              >
                +
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

      {showAddModal && (
        <AddPicturesModal
          albumId={albumId}
          userId={currentUser.id}
          alreadyInAlbum={new Set(pictures.map(p => p.id))}
          onClose={() => setShowAddModal(false)}
          onAdded={() => loadPictures(true)}
        />
      )}
    </div>
  );
}
