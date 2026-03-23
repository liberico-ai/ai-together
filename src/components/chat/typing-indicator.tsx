"use client";

interface Props {
  users: string[];
}

export function TypingIndicator({ users }: Props) {
  if (users.length === 0) return null;

  const text =
    users.length === 1
      ? `${users[0]} đang gõ`
      : users.length === 2
        ? `${users[0]} và ${users[1]} đang gõ`
        : `${users[0]} và ${users.length - 1} người khác đang gõ`;

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-[11px] text-stone-400 italic">{text}...</span>
    </div>
  );
}
