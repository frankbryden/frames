import React, { useState } from "react";
import { TagInput } from "./TagInput";

interface UploadFormProps {
  onUploadComplete: () => void;
}

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (10 MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10 MB");
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (description) formData.append("description", description);
      if (tags.length > 0) formData.append("tags", tags.join(","));

      const res = await fetch("/api/pictures/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Upload failed");
      }

      // Reset form
      setFile(null);
      setPreview(null);
      setDescription("");
      setTags([]);
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
        {/* File input */}
        <div className="mb-6">
          <label className="block text-sm font-light text-zinc-300 mb-2">
            Select Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-400 font-light file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-zinc-700 file:text-sm file:font-light file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-750 transition-all"
          />
          <p className="text-xs text-zinc-600 mt-2 font-light">Max 10 MB (JPEG, PNG, WebP)</p>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-6">
            <img
              src={preview}
              alt="Preview"
              className="max-w-full h-auto rounded-lg max-h-96 mx-auto"
            />
          </div>
        )}

        {/* Description */}
        <div className="mb-6">
          <label className="block text-sm font-light text-zinc-300 mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg focus:outline-none focus:border-zinc-600 font-light placeholder:text-zinc-600"
            placeholder="Describe your photo..."
          />
          <p className="text-xs text-zinc-600 mt-2 font-light">
            {description.length}/1000 characters
          </p>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <label className="block text-sm font-light text-zinc-300 mb-2">
            Tags (optional)
          </label>
          <TagInput value={tags} onChange={setTags} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-900 text-red-400 rounded-lg text-sm font-light">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full py-3 px-4 bg-zinc-800 border border-zinc-700 text-zinc-200 font-light rounded-lg hover:bg-zinc-750 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {uploading ? "Uploading..." : "Upload Picture"}
        </button>
      </form>
    </div>
  );
}
