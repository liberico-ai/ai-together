export class AppError extends Error {
  // `reason` narrows a code that has several causes (the bot says which one). It is a fixed upper-case word and names no project, BU or person.
  // Declared only, and set only when given: an error without one keeps the same own fields as before.
  declare reason?: string;
  constructor(public code: string, message: string, public status = 400, reason?: string) { super(message); if (reason !== undefined) this.reason = reason; }
}
export function invariant(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}
