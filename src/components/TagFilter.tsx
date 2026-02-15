import React from "react";
import type { Tag } from "../types";

interface TagFilterProps {
  tags: Tag[];
  selectedTags: string[];
  onSelectTags: (tags: string[]) => void;
}

export function TagFilter({ tags, selectedTags, onSelectTags }: TagFilterProps) {
  const handleToggle = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onSelectTags(selectedTags.filter(t => t !== tagName));
    } else {
      onSelectTags([...selectedTags, tagName]);
    }
  };

  const handleClear = () => {
    onSelectTags([]);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 sticky top-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-light text-zinc-200">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-zinc-500 hover:text-zinc-300 font-light transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-zinc-600 font-light">No tags yet</p>
      ) : (
        <div className="space-y-2">
          {tags.map(tag => (
            <label
              key={tag.id}
              className="flex items-center gap-3 cursor-pointer hover:bg-zinc-800 p-2 rounded transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.name)}
                onChange={() => handleToggle(tag.name)}
                className="rounded border-zinc-700 bg-zinc-800 text-zinc-200 focus:ring-zinc-600"
              />
              <span className="text-sm text-zinc-300 flex-1 font-light">{tag.name}</span>
              <span className="text-xs text-zinc-600 font-light">{tag.count || 0}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
