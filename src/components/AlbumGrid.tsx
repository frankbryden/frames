import React, { useState } from "react";
import type { Album } from "../types";

interface AlbumGridProps {
  albums: Album[];
  onAlbumClick: (albumId: number) => void;
  isOwner: boolean;
  onCreateAlbum?: (title: string) => void;
}

function BookIcon() {
  return (
    <svg className="w-8 h-8 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
    </svg>
  );
}

export function AlbumGrid({ albums, onAlbumClick, isOwner, onCreateAlbum }: AlbumGridProps) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onCreateAlbum?.(newTitle.trim());
    setNewTitle("");
    setCreatingNew(false);
  };

  if (albums.length === 0 && !isOwner) {
    return <p className="text-slate-400 font-light text-sm">No albums yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {albums.map(album => (
        <button
          key={album.id}
          onClick={() => onAlbumClick(album.id)}
          className="group relative aspect-square rounded-lg overflow-hidden bg-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          {album.cover_thumbnail_url ? (
            <img
              src={album.cover_thumbnail_url}
              alt={album.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <BookIcon />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-3">
            <p className="font-album-title text-sm text-white text-left leading-tight line-clamp-2">
              {album.title}
            </p>
          </div>
        </button>
      ))}

      {isOwner && (
        creatingNew ? (
          <div className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 p-3">
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreatingNew(false); setNewTitle(""); } }}
              placeholder="Album title..."
              className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-slate-400 font-light text-center"
            />
            <div className="flex gap-1">
              <button
                onClick={handleCreate}
                className="text-xs px-2 py-1 bg-slate-800 text-white rounded font-light hover:bg-slate-900 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => { setCreatingNew(false); setNewTitle(""); }}
                className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600 font-light transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreatingNew(true)}
            className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-all flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-600"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs font-light">New album</span>
          </button>
        )
      )}
    </div>
  );
}
