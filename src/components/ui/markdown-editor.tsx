"use client";

import dynamic from "next/dynamic";
import rehypeSanitize from "rehype-sanitize";
import { useTheme } from "next-themes";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
);

interface MarkdownEditorProps {
  value: string;
  onChange: (value?: string) => void;
  placeholder?: string;
  minHeight?: number;
  height?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 200,
  height,
  onKeyDown,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div data-color-mode={resolvedTheme === "dark" ? "dark" : "light"} className="rounded-xl overflow-hidden border border-input shadow-sm">
      <MDEditor
        value={value}
        onChange={onChange}
        previewOptions={{
          rehypePlugins: [[rehypeSanitize]],
        }}
        textareaProps={{
          placeholder: placeholder || "Type your markdown here...",
          onKeyDown: onKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>,
        }}
        minHeight={minHeight}
        height={height}
        preview="edit"
        className="w-full !border-0 !rounded-none"
      />
    </div>
  );
}

export const MarkdownPreview = dynamic(
  () => import("@uiw/react-markdown-preview").then((mod) => mod.default),
  { ssr: false }
);
