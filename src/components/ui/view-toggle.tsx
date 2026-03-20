"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { useEffect, useState } from "react";

export type ViewMode = "card" | "table";

interface ViewToggleProps {
  storageKey: string;
  defaultView?: ViewMode;
  onChange?: (view: ViewMode) => void;
}

export function useViewMode(storageKey: string, defaultView: ViewMode = "card") {
  const [view, setView] = useState<ViewMode>(defaultView);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "card" || saved === "table") setView(saved);
  }, [storageKey]);

  const setAndPersist = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(storageKey, v);
  };

  return [view, setAndPersist] as const;
}

export function ViewToggle({ storageKey, defaultView = "card", onChange }: ViewToggleProps) {
  const [view, setView] = useViewMode(storageKey, defaultView);

  const handleChange = (v: ViewMode) => {
    setView(v);
    onChange?.(v);
  };

  const modes: { value: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
    { value: "card", icon: LayoutGrid, label: "Cards" },
    { value: "table", icon: Table2, label: "Table" },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5">
      {modes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => handleChange(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
            ${view === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
