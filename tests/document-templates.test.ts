import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
type Entry = { code: string; version: string; docType: string; title: string; path: string; sha256: string };
const manifest = JSON.parse(readFileSync(join(root, "docs/templates/manifest.json"), "utf8")) as {
  schema: number;
  templates: Entry[];
};
const read = (e: Entry) => readFileSync(join(root, e.path));

const METADATA_LABELS = [
  "Mã tài liệu / dự án / BU",
  "Loại / tiêu đề",
  "Tác giả / chủ nội dung / reviewer có quyền",
  "Nguồn chính / revision nguồn",
  "Bản nháp / bản chuẩn đã duyệt",
  "Phạm vi xem / nhóm được nhận",
  "Yêu cầu / việc / quyết định liên quan",
  "Thời điểm nguồn / kiểm gần nhất / hạn review",
  "Nguồn dẫn và giới hạn đã đọc",
];

describe("PM document templates T0-T6", () => {
  it("manifest lists exactly T0..T6 once each with semver versions", () => {
    expect(manifest.schema).toBe(1);
    expect(manifest.templates.map((t) => t.code)).toEqual(["T0", "T1", "T2", "T3", "T4", "T5", "T6"]);
    expect(manifest.templates.map((t) => t.docType)).toEqual([
      "project_index", "change_brief", "requirements", "design", "plan", "verification", "guide",
    ]);
    for (const t of manifest.templates) expect(t.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("every manifest hash equals the sha256 of the file bytes", () => {
    for (const t of manifest.templates) {
      expect(t.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(createHash("sha256").update(read(t)).digest("hex")).toBe(t.sha256);
    }
  });

  it("every template carries its code, version and the nine metadata rows", () => {
    for (const t of manifest.templates) {
      const text = read(t).toString("utf8");
      expect(text.endsWith("\n")).toBe(true);
      expect(text.includes("\r")).toBe(false);
      const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
      expect(m, t.code).not.toBeNull();
      const fm = m![1];
      expect(fm).toContain(`code: ${t.code}`);
      expect(fm).toContain(`version: ${t.version}`);
      expect(fm).toContain(`doc_type: ${t.docType}`);
      expect(fm).toMatch(/source: docs\/PM-DOCUMENT-TEMPLATES\.md:\d+-\d+/);
      const body = text.slice(m![0].length);
      for (const label of METADATA_LABELS) expect(body, `${t.code} ${label}`).toContain(`| ${label} |`);
      expect(body).toContain(`## ${t.code} —`);
    }
  });

  it("templates contain no credential or real chat identifier", () => {
    for (const t of manifest.templates) {
      const text = read(t).toString("utf8");
      expect(text).not.toMatch(/-100\d{6,}/);
      expect(text).not.toMatch(/(token|password|secret)\s*[:=]\s*\S+/i);
    }
  });
});
