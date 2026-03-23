"use client";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  return (
    <div className="absolute right-0 top-0 z-10 flex gap-1 p-1.5 rounded-lg bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 animate-in fade-in duration-150">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="h-8 w-8 rounded-md hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-lg transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
