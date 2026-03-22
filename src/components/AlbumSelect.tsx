import React, { useState, useEffect, useRef } from "react";
import type { Album, AlbumRef } from "../types";

interface AlbumSelectProps {
  userId: number;
  value: AlbumRef[];
  onChange: (albums: AlbumRef[]) => void;
}

export function AlbumSelect({ userId, value, onChange }: AlbumSelectProps) {
  const [allAlbums, setAllAlbums] = useState<Album[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/users/${userId}/albums`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setAllAlbums)
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setCreatingNew(false);
        setNewAlbumTitle("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const selectedIds = new Set(value.map(a => a.id));
  const available = allAlbums.filter(a => !selectedIds.has(a.id));

  const handleAdd = (album: Album) => {
    onChange([...value, { id: album.id, title: album.title }]);
    setDropdownOpen(false);
  };

  const handleRemove = (albumId: number) => {
    onChange(value.filter(a => a.id !== albumId));
  };

  const handleCreateNew = async () => {
    if (!newAlbumTitle.trim()) return;
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newAlbumTitle.trim() }),
      });
      if (res.ok) {
        const album = await res.json();
        setAllAlbums(prev => [album, ...prev]);
        onChange([...value, { id: album.id, title: album.title }]);
        setNewAlbumTitle("");
        setCreatingNew(false);
        setDropdownOpen(false);
      }
    } catch {}
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map(album => (
          <span
            key={album.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-600 font-light"
          >
            {album.title}
            <button
              onClick={() => handleRemove(album.id)}
              className="text-slate-400 hover:text-slate-700 transition-colors leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setDropdownOpen(v => !v)}
          className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600 border border-dashed border-slate-300 hover:border-slate-400 rounded font-light transition-colors"
        >
          + album
        </button>
      </div>

      {dropdownOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
          {available.map(album => (
            <button
              key={album.id}
              onClick={() => handleAdd(album)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-light transition-colors"
            >
              {album.title}
            </button>
          ))}
          {available.length > 0 && <div className="border-t border-slate-100" />}
          {creatingNew ? (
            <div className="p-2 flex gap-1">
              <input
                autoFocus
                value={newAlbumTitle}
                onChange={e => setNewAlbumTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateNew(); if (e.key === "Escape") { setCreatingNew(false); setNewAlbumTitle(""); } }}
                placeholder="Album title..."
                className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-slate-400 font-light"
              />
              <button
                onClick={handleCreateNew}
                className="text-xs px-2 py-1 bg-slate-800 text-white rounded font-light hover:bg-slate-900 transition-colors"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 font-light transition-colors"
            >
              + New album
            </button>
          )}
        </div>
      )}
    </div>
  );
}
