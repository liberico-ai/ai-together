// Pure text check shared by the document review schemas and the skill-output gate. No imports: it must never reach the database.
// PostgreSQL cannot store U+0000 or a lone surrogate in text/jsonb; it answers with a raw error.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
export const storable = (s: string) => !s.includes('\u0000') && !LONE_SURROGATE.test(s);
