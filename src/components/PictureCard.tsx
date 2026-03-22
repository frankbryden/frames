import React, { useState, useRef, useEffect } from "react";
import type { Picture, User, AlbumRef } from "../types";
import { TagInput } from "./TagInput";
import { AlbumSelect } from "./AlbumSelect";
import { FRAMES, getFrame } from "../frames";

interface PictureCardProps {
  picture: Picture & {
    compressed_url?: string;
    thumbnail_url?: string;
    like_count?: number;
    dislike_count?: number;
    user_like?: boolean | null;
    user_name?: string;
  };
  currentUser: User;
  onUpdate?: () => void;
  onUserClick?: (userId: number) => void;
  onAlbumClick?: (albumId: number) => void;
  onSetCover?: (pictureId: number) => void;
}

function AlbumIconOverlay({ albums, onAlbumClick }: { albums: AlbumRef[]; onAlbumClick?: (albumId: number) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (albums.length === 1) {
      onAlbumClick?.(albums[0].id);
    } else {
      setMenuOpen(v => !v);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleClick}
        className="flex items-center text-slate-400 hover:text-slate-700 transition-colors"
        title={albums.length === 1 ? albums[0].title : "In multiple albums"}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
        </svg>
      </button>
      {menuOpen && albums.length > 1 && (
        <div className="absolute right-0 bottom-full mb-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
          {albums.map(album => (
            <button
              key={album.id}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAlbumClick?.(album.id); }}
              className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 font-light transition-colors"
            >
              {album.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CameraTooltipContent({ picture }: { picture: PictureCardProps["picture"] }) {
  const lines: { text: string; muted: boolean }[] = [];

  const cameraName = [picture.camera_make, picture.camera_model].filter(Boolean).join(" ");
  if (cameraName) lines.push({ text: cameraName, muted: false });
  if (picture.lens_model) lines.push({ text: picture.lens_model, muted: true });

  const settings: string[] = [];
  if (picture.f_number != null) settings.push(`f/${picture.f_number}`);
  if (picture.exposure_time) settings.push(picture.exposure_time);
  if (picture.iso != null) settings.push(`ISO ${picture.iso}`);
  if (picture.focal_length != null) settings.push(`${picture.focal_length}mm`);
  if (settings.length > 0) lines.push({ text: settings.join("  ·  "), muted: true });

  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={`${i > 0 ? "mt-1" : ""} ${line.muted ? "text-slate-400" : "text-slate-100 font-normal"}`}>
          {line.text}
        </p>
      ))}
    </>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 365) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PictureCard({ picture, currentUser, onUpdate, onUserClick, onAlbumClick, onSetCover }: PictureCardProps) {
  const [showFullSize, setShowFullSize] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(picture.like_count || 0);
  const [localDislikeCount, setLocalDislikeCount] = useState(picture.dislike_count || 0);
  const [localUserLike, setLocalUserLike] = useState(picture.user_like);
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(picture.description || "");
  const [editTags, setEditTags] = useState((picture.tags || []).map(t => t.name));
  const [editFrame, setEditFrame] = useState(picture.frame || 'none');
  const [editAlbums, setEditAlbums] = useState<AlbumRef[]>(picture.albums || []);
  const [saving, setSaving] = useState(false);

  const isOwner = picture.user_id === currentUser.id;
  const hasCameraInfo = !!(picture.camera_make || picture.camera_model);
  const frame = getFrame(editing ? editFrame : picture.frame);

  const handleLike = async (isLike: boolean) => {
    try {
      const res = await fetch(`/api/pictures/${picture.id}/like`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLike }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalLikeCount(data.like_count);
        setLocalDislikeCount(data.dislike_count);
        setLocalUserLike(data.user_like);
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await fetch(`/api/pictures/${picture.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription, frame: editFrame }),
      });

      const originalTags = (picture.tags || []).map(t => t.name);
      const tagsToAdd = editTags.filter(t => !originalTags.includes(t));
      const tagsToRemove = originalTags.filter(t => !editTags.includes(t));

      if (tagsToAdd.length > 0) {
        await fetch(`/api/pictures/${picture.id}/tags`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: tagsToAdd }),
        });
      }
      if (tagsToRemove.length > 0) {
        await fetch(`/api/pictures/${picture.id}/tags`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: tagsToRemove }),
        });
      }

      const originalAlbums = (picture.albums || []).map(a => a.id);
      const currentAlbums = editAlbums.map(a => a.id);
      const albumsToAdd = editAlbums.filter(a => !originalAlbums.includes(a.id));
      const albumsToRemove = (picture.albums || []).filter(a => !currentAlbums.includes(a.id));

      await Promise.all([
        ...albumsToAdd.map(a =>
          fetch(`/api/albums/${a.id}/pictures`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pictureId: picture.id }),
          })
        ),
        ...albumsToRemove.map(a =>
          fetch(`/api/albums/${a.id}/pictures/${picture.id}`, {
            method: "DELETE",
            credentials: "include",
          })
        ),
      ]);

      setEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to save edits:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDescription(picture.description || "");
    setEditTags((picture.tags || []).map(t => t.name));
    setEditFrame(picture.frame || 'none');
    setEditAlbums(picture.albums || []);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this picture?")) return;
    try {
      const res = await fetch(`/api/pictures/${picture.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok && onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to delete picture:", error);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all shadow-sm hover:shadow-md duration-200">
        <div className={`relative group overflow-hidden rounded-t-lg ${frame.wrapperClass}`}>
          <img
            src={picture.thumbnail_url || ""}
            alt={picture.description || "Photo"}
            className={`cursor-pointer hover:opacity-80 transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${frame.imageClass}`}
            onClick={() => setShowFullSize(true)}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />
          {onSetCover && (
            <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onSetCover(picture.id); }}
                className="px-2 py-1 bg-black/70 text-white text-xs rounded font-light hover:bg-black/90 transition-colors"
              >
                Set as cover
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => onUserClick?.(picture.user_id)}
              className="text-sm font-light text-slate-700 hover:text-slate-900 transition-colors"
            >
              {picture.user_name || "Unknown"}
            </button>
            <span
              className="text-xs text-slate-400 font-light"
              title={new Date(picture.taken_at ?? picture.uploaded_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            >
              {formatDate(picture.taken_at ?? picture.uploaded_at)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {picture.albums && picture.albums.length > 0 && (
                <AlbumIconOverlay albums={picture.albums} onAlbumClick={onAlbumClick} />
              )}
              {hasCameraInfo && (
                <div className="relative group/camera">
                  <div className="text-slate-400 cursor-default">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="absolute right-0 bottom-full mb-1 w-56 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs font-light opacity-0 group-hover/camera:opacity-100 pointer-events-none transition-opacity z-10">
                    <CameraTooltipContent picture={picture} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <div className="mb-3">
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 font-light resize-none focus:outline-none focus:border-slate-400 mb-2"
                rows={2}
              />
              <div className="mb-2">
                <TagInput value={editTags} onChange={setEditTags} />
              </div>
              <div className="flex gap-2 mb-3 flex-wrap">
                {FRAMES.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setEditFrame(f.id)}
                    className={`px-2 py-1 text-xs rounded border font-light transition-colors ${
                      editFrame === f.id
                        ? 'border-slate-500 text-slate-900 bg-slate-100'
                        : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mb-3">
                <AlbumSelect
                  userId={currentUser.id}
                  value={editAlbums}
                  onChange={setEditAlbums}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="text-sm text-slate-800 hover:text-slate-900 font-light transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="text-sm text-slate-400 hover:text-slate-600 font-light transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {picture.description && (
                <p className="text-slate-500 text-sm font-light mb-3">{picture.description}</p>
              )}
              {picture.tags && picture.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {picture.tags.map(tag => (
                    <span
                      key={tag.id}
                      className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded border border-slate-200 font-light"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleLike(true)}
                className={`flex items-center gap-1 transition-colors ${
                  localUserLike === true ? "text-slate-900" : "text-slate-300 hover:text-slate-500"
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span className="text-sm font-light">{localLikeCount}</span>
              </button>

              <button
                onClick={() => handleLike(false)}
                className={`flex items-center gap-1 transition-colors ${
                  localUserLike === false ? "text-slate-900" : "text-slate-300 hover:text-slate-500"
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ transform: "rotate(180deg)" }}>
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span className="text-sm font-light">{localDislikeCount}</span>
              </button>
            </div>

            {isOwner && !editing && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-slate-400 hover:text-slate-600 font-light transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-sm text-slate-400 hover:text-slate-600 font-light transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showFullSize && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-16"
          onClick={() => setShowFullSize(false)}
        >
          <div className={frame.modalWrapperClass} onClick={e => e.stopPropagation()}>
            <img
              src={picture.compressed_url || ""}
              alt={picture.description || "Photo"}
              className="max-h-[70vh] max-w-[80vw] object-contain block"
            />
          </div>
          <button
            onClick={() => setShowFullSize(false)}
            className="absolute top-6 right-6 text-slate-400 text-4xl hover:text-slate-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
