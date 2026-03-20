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

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 sticky top-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-light text-slate-700">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={() => onSelectTags([])}
            className="text-xs text-slate-400 hover:text-slate-600 font-light transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-slate-400 font-light">No tags yet</p>
      ) : (
        <div className="space-y-1">
          {tags.map(tag => (
            <label
              key={tag.id}
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.name)}
                onChange={() => handleToggle(tag.name)}
                className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
              />
              <span className="text-sm text-slate-600 flex-1 font-light">{tag.name}</span>
              <span className="text-xs text-slate-400 font-light">{tag.count || 0}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
