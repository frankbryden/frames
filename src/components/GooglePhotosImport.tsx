import React, { useState, useEffect, useCallback } from "react";

interface Album {
  id: string;
  title: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: string;
}

interface MediaItem {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    width: string;
    height: string;
    creationTime: string;
  };
}

type Stage = "albums" | "media" | "importing" | "done";

interface Props {
  onImportComplete: () => void;
}

export function GooglePhotosImport({ onImportComplete }: Props) {
  const [stage, setStage] = useState<Stage>("albums");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/google-photos/albums", { credentials: "include" })
      .then((res) => {
        if (!res.ok) return res.text().then((t) => Promise.reject(t));
        return res.json();
      })
      .then((data: Album[]) => setAlbums(data))
      .catch((e) => setError(typeof e === "string" ? e : "Failed to load albums"))
      .finally(() => setLoading(false));
  }, []);

  const openAlbum = useCallback(async (album: Album | null) => {
    setSelectedAlbum(album);
    setMediaItems([]);
    setNextPageToken(undefined);
    setSelected(new Set());
    setStage("media");
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (album) params.set("albumId", album.id);
      const res = await fetch(`/api/google-photos/media?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data: { items: MediaItem[]; nextPageToken?: string } = await res.json();
      setMediaItems(data.items.filter((i) => i.mimeType.startsWith("image/")));
      setNextPageToken(data.nextPageToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (selectedAlbum) params.set("albumId", selectedAlbum.id);
      params.set("pageToken", nextPageToken);
      const res = await fetch(`/api/google-photos/media?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data: { items: MediaItem[]; nextPageToken?: string } = await res.json();
      setMediaItems((prev) => [...prev, ...data.items.filter((i) => i.mimeType.startsWith("image/"))]);
      setNextPageToken(data.nextPageToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more photos");
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore, selectedAlbum]);

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(mediaItems.map((i) => i.id)));
  const clearAll = () => setSelected(new Set());

  const handleImport = async () => {
    if (selected.size === 0) return;
    setStage("importing");
    setImportProgress({ done: 0, total: selected.size });

    try {
      const res = await fetch("/api/google-photos/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { imported: number } = await res.json();
      setImportProgress({ done: data.imported, total: selected.size });
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setStage("media");
    }
  };

  if (stage === "done" && importProgress) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="text-5xl font-light text-zinc-50">{importProgress.done}</div>
        <div className="text-zinc-400 font-light">photos imported successfully</div>
        <button
          onClick={onImportComplete}
          className="px-6 py-2.5 bg-zinc-800 text-zinc-200 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
        >
          View Timeline
        </button>
      </div>
    );
  }

  if (stage === "importing") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-zinc-400 font-light">Importing {selected.size} photo{selected.size !== 1 ? "s" : ""}…</div>
        <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-zinc-400 rounded-full animate-pulse w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Albums stage */}
      {stage === "albums" && (
        <>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-light text-zinc-200">Google Photos</h2>
          </div>

          {error && <div className="text-red-400 text-sm mb-6">{error}</div>}

          {loading ? (
            <div className="text-zinc-500 font-light py-16 text-center">Loading albums…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                {/* All photos option */}
                <button
                  onClick={() => openAlbum(null)}
                  className="group relative aspect-square bg-zinc-800 rounded-lg overflow-hidden hover:ring-1 hover:ring-zinc-600 transition-all"
                >
                  <div className="absolute inset-0 flex items-end p-3 bg-gradient-to-t from-zinc-950/80">
                    <div className="text-left">
                      <div className="text-zinc-200 text-xs font-normal truncate">All Photos</div>
                    </div>
                  </div>
                </button>

                {albums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => openAlbum(album)}
                    className="group relative aspect-square bg-zinc-800 rounded-lg overflow-hidden hover:ring-1 hover:ring-zinc-600 transition-all"
                  >
                    {album.coverPhotoBaseUrl && (
                      <img
                        src={`${album.coverPhotoBaseUrl}=w400-h400-c`}
                        alt={album.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 flex items-end p-3 bg-gradient-to-t from-zinc-950/80">
                      <div className="text-left">
                        <div className="text-zinc-200 text-xs font-normal truncate">{album.title}</div>
                        {album.mediaItemsCount && (
                          <div className="text-zinc-400 text-xs">{album.mediaItemsCount}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Media stage */}
      {stage === "media" && (
        <>
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setStage("albums")}
              className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              ← Albums
            </button>
            <h2 className="text-xl font-light text-zinc-200">
              {selectedAlbum ? selectedAlbum.title : "All Photos"}
            </h2>
            <div className="ml-auto flex items-center gap-3">
              {mediaItems.length > 0 && (
                <>
                  <button
                    onClick={selected.size === mediaItems.length ? clearAll : selectAll}
                    className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                  >
                    {selected.size === mediaItems.length ? "Deselect all" : "Select all"}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selected.size === 0}
                    className="px-5 py-2 bg-zinc-200 text-zinc-900 rounded-lg text-sm font-normal disabled:opacity-40 hover:bg-zinc-100 transition-colors"
                  >
                    Import {selected.size > 0 ? `${selected.size} ` : ""}photo{selected.size !== 1 ? "s" : ""}
                  </button>
                </>
              )}
            </div>
          </div>

          {error && <div className="text-red-400 text-sm mb-6">{error}</div>}

          {loading ? (
            <div className="text-zinc-500 font-light py-16 text-center">Loading photos…</div>
          ) : mediaItems.length === 0 ? (
            <div className="text-zinc-500 font-light py-16 text-center">No photos in this album</div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {mediaItems.map((item) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden transition-all ${
                        isSelected
                          ? "ring-2 ring-zinc-200"
                          : "hover:ring-1 hover:ring-zinc-600"
                      }`}
                    >
                      <img
                        src={`${item.baseUrl}=w300-h300-c`}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-zinc-200 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {nextPageToken && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
