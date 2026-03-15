import React, { useState } from "react";
import type { Picture, User } from "../types";

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
        <p key={i} className={`${i > 0 ? "mt-1" : ""} ${line.muted ? "text-zinc-400" : "text-zinc-100 font-normal"}`}>
          {line.text}
        </p>
      ))}
    </>
  );
}

export function PictureCard({ picture, currentUser, onUpdate, onUserClick }: PictureCardProps) {
  const [showFullSize, setShowFullSize] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(picture.like_count || 0);
  const [localDislikeCount, setLocalDislikeCount] = useState(picture.dislike_count || 0);
  const [localUserLike, setLocalUserLike] = useState(picture.user_like);

  const isOwner = picture.user_id === currentUser.id;
  const hasCameraInfo = !!(picture.camera_make || picture.camera_model);

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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this picture?")) return;

    try {
      const res = await fetch(`/api/pictures/${picture.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok && onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to delete picture:", error);
    }
  };

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors">
        <div className="relative group">
          <img
            src={picture.thumbnail_url || ""}
            alt={picture.description || "Photo"}
            className="w-full h-64 object-cover cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowFullSize(true)}
            loading="lazy"
          />
          {hasCameraInfo && (
            <div className="absolute top-2 right-2">
              <div className="relative">
                <div className="p-1.5 bg-black/60 rounded-md text-zinc-300 cursor-default">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="absolute right-0 top-8 w-56 p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl text-xs font-light opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  <CameraTooltipContent picture={picture} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => onUserClick?.(picture.user_id)}
              className="text-sm font-light text-zinc-200 hover:text-zinc-50 transition-colors"
            >
              {picture.user_name || "Unknown"}
            </button>
            <span className="text-xs text-zinc-500 font-light">
              {new Date(picture.uploaded_at).toLocaleDateString()}
            </span>
          </div>

          {picture.description && (
            <p className="text-zinc-400 text-sm font-light mb-3">{picture.description}</p>
          )}

          {picture.tags && picture.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {picture.tags.map(tag => (
                <span
                  key={tag.id}
                  className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded border border-zinc-700 font-light"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleLike(true)}
                className={`flex items-center gap-1 transition-colors ${
                  localUserLike === true
                    ? "text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-300"
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
                  localUserLike === false
                    ? "text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  style={{ transform: "rotate(180deg)" }}
                >
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span className="text-sm font-light">{localDislikeCount}</span>
              </button>
            </div>

            {isOwner && (
              <button
                onClick={handleDelete}
                className="text-sm text-zinc-500 hover:text-zinc-300 font-light transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {showFullSize && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullSize(false)}
        >
          <img
            src={picture.compressed_url || ""}
            alt={picture.description || "Photo"}
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setShowFullSize(false)}
            className="absolute top-6 right-6 text-zinc-400 text-4xl hover:text-zinc-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
