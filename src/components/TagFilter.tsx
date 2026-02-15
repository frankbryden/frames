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
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Clear
          </button>
        )}
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-gray-500">No tags yet</p>
      ) : (
        <div className="space-y-2">
          {tags.map(tag => (
            <label
              key={tag.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.name)}
                onChange={() => handleToggle(tag.name)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 flex-1">{tag.name}</span>
              <span className="text-xs text-gray-500">{tag.count || 0}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
