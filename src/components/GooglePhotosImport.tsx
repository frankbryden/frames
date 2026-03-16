import React, { useState, useEffect, useRef } from "react";

interface PickerMediaItem {
  id: string;
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
    mediaFileMetadata?: { width?: number; height?: number };
  };
}

type Stage = "idle" | "creating" | "picking" | "confirming" | "importing" | "done";

interface Props {
  onImportComplete: () => void;
}

export function GooglePhotosImport({ onImportComplete }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [items, setItems] = useState<PickerMediaItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  const startPicker = async () => {
    setError(null);
    setStage("creating");

    try {
      const res = await fetch("/api/google-photos/picker/session", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const { sessionId: sid, pickerUri } = await res.json();

      setSessionId(sid);
      setStage("picking");

      // Open picker in a popup
      const popup = window.open(pickerUri, "google-photos-picker", "width=1200,height=800");
      popupRef.current = popup;

      // Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/google-photos/picker/session/${sid}`, {
            credentials: "include",
          });
          if (!pollRes.ok) throw new Error(await pollRes.text());
          const data: { ready: boolean; items?: PickerMediaItem[] } = await pollRes.json();

          if (data.ready && data.items) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
            const photos = data.items.filter((i) => i.mediaFile.mimeType.startsWith("image/"));
            setItems(photos);
            setStage("confirming");
          }
        } catch (e) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setError(e instanceof Error ? e.message : "Polling failed");
          setStage("idle");
        }
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start picker");
      setStage("idle");
    }
  };

  const cancelPicking = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setStage("idle");
    setSessionId(null);
  };

  const handleImport = async () => {
    if (!sessionId) return;
    setStage("importing");

    try {
      const res = await fetch("/api/google-photos/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { imported: number } = await res.json();
      setImportedCount(data.imported);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setStage("confirming");
    }
  };

  if (stage === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="text-5xl font-light text-zinc-50">{importedCount}</div>
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
        <div className="text-zinc-400 font-light">Importing {items.length} photo{items.length !== 1 ? "s" : ""}…</div>
        <div className="w-48 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-zinc-400 rounded-full animate-pulse w-full" />
        </div>
      </div>
    );
  }

  if (stage === "confirming") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-light text-zinc-200">
            {items.length} photo{items.length !== 1 ? "s" : ""} selected
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setStage("idle"); setSessionId(null); setItems([]); }}
              className="px-5 py-2 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="px-5 py-2 bg-zinc-200 text-zinc-900 rounded-lg text-sm font-normal hover:bg-zinc-100 transition-colors"
            >
              Import {items.length} photo{items.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>

        {error && <div className="text-red-400 text-sm mb-6">{error}</div>}

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {items.map((item) => (
            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800">
              <img
                src={`/api/google-photos/thumbnail?url=${encodeURIComponent(item.mediaFile.baseUrl)}`}
                alt={item.mediaFile.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="text-zinc-300 font-light text-lg">Import from Google Photos</div>
      <div className="text-zinc-500 text-sm text-center max-w-sm">
        {stage === "picking"
          ? "Select your photos in the Google Photos window, then come back here."
          : "Choose photos from your Google Photos library to import into Frames."}
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {stage === "idle" && (
        <button
          onClick={startPicker}
          className="flex items-center gap-2 px-6 py-3 bg-zinc-200 text-zinc-900 rounded-lg text-sm font-normal hover:bg-zinc-100 transition-colors"
        >
          Open Google Photos
        </button>
      )}

      {stage === "creating" && (
        <div className="text-zinc-500 text-sm">Opening picker…</div>
      )}

      {stage === "picking" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <span className="inline-block w-2 h-2 bg-zinc-400 rounded-full animate-pulse" />
            Waiting for selection…
          </div>
          <button
            onClick={cancelPicking}
            className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
