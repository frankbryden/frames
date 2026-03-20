import React, { useState } from "react";
import { TagInput } from "./TagInput";
import { FRAMES, getFrame } from "../frames";

interface UploadFormProps {
  onUploadComplete: () => void;
}

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [frame, setFrame] = useState("none");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError("File too large. Maximum size is 10 MB"); return; }

    setFile(selectedFile);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Please select a file"); return; }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (description) formData.append("description", description);
      if (tags.length > 0) formData.append("tags", tags.join(","));
      formData.append("frame", frame);

      const res = await fetch("/api/pictures/upload", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error(await res.text() || "Upload failed");

      setFile(null); setPreview(null); setDescription(""); setTags([]); setFrame("none");
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
        {/* File input */}
        <div className="mb-6">
          <label className="block text-sm font-light text-slate-600 mb-2">Select Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 font-light file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-slate-200 file:text-sm file:font-light file:bg-slate-50 file:text-slate-600 hover:file:bg-slate-100 transition-all"
          />
          <p className="text-xs text-slate-400 mt-2 font-light">Max 10 MB (JPEG, PNG, WebP)</p>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-6">
            <div className={`inline-block mx-auto ${getFrame(frame).wrapperClass}`} style={{ display: 'block' }}>
              <img src={preview} alt="Preview" className="max-w-full h-auto rounded-sm max-h-80 mx-auto block" />
            </div>
          </div>
        )}

        {/* Frame */}
        <div className="mb-6">
          <label className="block text-sm font-light text-slate-600 mb-2">Frame (optional)</label>
          <div className="flex gap-2 flex-wrap">
            {FRAMES.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrame(f.id)}
                className={`px-3 py-1.5 text-sm rounded border font-light transition-colors ${
                  frame === f.id
                    ? 'border-slate-500 text-slate-900 bg-slate-100'
                    : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-sm font-light text-slate-600 mb-2">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg focus:outline-none focus:border-slate-400 font-light placeholder:text-slate-400"
            placeholder="Describe your photo..."
          />
          <p className="text-xs text-slate-400 mt-2 font-light">{description.length}/1000 characters</p>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <label className="block text-sm font-light text-slate-600 mb-2">Tags (optional)</label>
          <TagInput value={tags} onChange={setTags} />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-light">{error}</div>
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full py-3 px-4 bg-slate-800 border border-slate-700 text-white font-light rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {uploading ? "Uploading..." : "Upload Picture"}
        </button>
      </form>
    </div>
  );
}
