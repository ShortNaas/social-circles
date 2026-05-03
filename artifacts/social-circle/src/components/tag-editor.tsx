import { useState, useRef } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TagEditor({ tags, onChange, disabled, placeholder = "Add tag…" }: TagEditorProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || tags.includes(tag)) { setInput(""); return; }
    onChange([...tags, tag]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 min-h-9 px-2 py-1.5 rounded-md border border-border bg-background cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-primary/60 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <div className="flex items-center gap-1 flex-1 min-w-[100px]">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (input.trim()) addTag(input); }}
            placeholder={tags.length === 0 ? placeholder : ""}
            className="h-6 border-0 shadow-none p-0 text-xs focus-visible:ring-0 bg-transparent"
            disabled={disabled}
          />
          {input.trim() && (
            <button
              type="button"
              onClick={() => addTag(input)}
              className="text-primary hover:text-primary/80"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
