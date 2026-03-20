import React, { useState, useEffect, useRef } from "react";
import type { Tag } from "../types";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tags", { credentials: "include" })
      .then(r => r.json())
      .then(setAllTags)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalised = input.trim().toLowerCase();
  const suggestions = allTags.filter(t => t.name.includes(normalised) && !value.includes(t.name));
  const inputIsNew = normalised.length > 0 && !allTags.some(t => t.name === normalised);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
    setDropdownOpen(false);
  };

  const removeTag = (tag: string) => onChange(value.filter(t => t !== tag));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (normalised) addTag(normalised);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const showDropdown = dropdownOpen && normalised.length > 0 && (suggestions.length > 0 || inputIsNew);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded focus-within:border-slate-400 min-h-[2.5rem]">
        {value.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => removeTag(tag)}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded font-light hover:bg-slate-300 hover:text-slate-800 transition-colors"
          >
            {tag}
            <span className="text-slate-400 hover:text-slate-700 leading-none text-sm">×</span>
          </button>
        ))}
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setDropdownOpen(true); }}
          onFocus={() => normalised.length > 0 && setDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[6rem] bg-transparent text-xs text-slate-700 font-light focus:outline-none placeholder:text-slate-400"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg overflow-hidden">
          {suggestions.map(tag => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); addTag(tag.name); }}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 font-light hover:bg-slate-50 flex items-center justify-between"
            >
              <span>{tag.name}</span>
              {tag.count != null && <span className="text-slate-400">{tag.count}</span>}
            </button>
          ))}
          {inputIsNew && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); addTag(normalised); }}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 font-light hover:bg-slate-50 flex items-center gap-2"
            >
              <span>{normalised}</span>
              <span className="text-slate-400">New Tag</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
