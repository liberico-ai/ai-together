# DELIVERY-023 — GIAO VIỆC 7: bản 0.9.2 «mở khoá»

Ngày 25/11/2026 · nhánh nền `libetech-ai-os` · phiên Claude Code làm GIAO VIỆC 7 (`~/.codex_prompts/2026-11-25_ClaudeCode_GIAO-VIEC-7.md`, SHA-256 `9a12d727d78896f3f4610252d5a72fada1a26e5f4196f2afce2c42ef7f4d3f80`)

## Căn cứ

- **Lời Chairman 25/11/2026 17:48, chép nguyên:** «Mục tiêu là cả team dùng được sau go live, nên em tự ra quyết định. Đừng Go live xong không làm được gì. lỗi có thể sửa . Đừng khoá chặt , team Tech cũng cần học và trải nghiệm»
- **Quyết định:** OQ-60, OQ-61 và OQ-62 do phiên điều phối (Cowork) quyết theo uỷ quyền Chairman 25/11/2026 17:48; Chairman có thể đổi. Toàn văn ở khối «GIAO VIỆC 7» cuối `docs/OPEN-QUESTIONS.md`.
- **Kế hoạch:** `docs/plans/gv7-unlock-092.md`. Kế hoạch ghi zone ghi của từng mục, theo OQ-62 câu 9 (2).

## Mức của từng mục

Hai mức đầu có bằng chứng ở `docs/reviews/gv7-unlock-evidence-20261125/`. Hai mức sau («Đã triển khai», «Đã nghiệm thu với team») chỉ được điền khi có bằng chứng từ d1-ai1 và biên bản nghiệm thu. Phiên này không vào máy chủ.

| Mục | Mức | Ca kiểm chính | Còn lại |
|---|---|---|---|
| M1 ghế BoM nhận việc, kể cả người duyệt | Đã có mã · đã thử trên CSDL thử | `unlock-092` M1 (2 ca) | Kịch bản nghiệm thu 9 |
| M2 Team Tech nhận việc ở mọi dự án | Đã có mã · đã thử trên CSDL thử | `unlock-092` M2 (5 ca), IBS HI M2, `SELF_GRANT`, `grant`, `revise`, `live` | Kịch bản 8 |
| M3 ghế đổi người đề xuất | Đã có mã · đã thử trên CSDL thử | `unlock-092` M3; `work-requests-ui` | Kịch bản 9; Q-GV7-1 |
| M4 dòng nguồn bất biến, điền bù 0.9.1 | Đã có mã · đã thử trên CSDL thử | `unlock-092` M4 (4 ca); `migrations-rollback` 028 (2 ca, gồm tiền tố của người vận hành) | Kịch bản 2 và 11 |
| M5 BoM Tech duyệt ở mọi dự án | Đã có mã · đã thử trên CSDL thử | `unlock-092` M5 (6 ca), IBS HI M5, F6 (3 ca) | Kịch bản 12; người vận hành ghi ba BoM Tech |
| M6 Tech chưa có membership đăng nhập | Đã có mã · đã thử trên CSDL thử | `unlock-092` M6 (2 ca) và BoM Tech ngoài roster gửi yêu cầu (1 ca) | Kịch bản 12 |
| M7 duyệt hàng loạt và cả lô nhập | Đã có mã · đã thử trên CSDL thử | `unlock-092` M7 (4 ca); `sheet-import` M7; `work-requests-ui` | Kịch bản 10 |
| M8 OQ-62 (mã từ ghi chú, tên tệp, Team Tech ở ô phụ trách) | Đã có mã · đã thử trên CSDL thử | `sheet-import`; `work-import-ui` (tên tệp gửi từ màn hình) | Cờ `LIBETECH_WORK_IMPORT` bật lúc triển khai; EV-10 |
| M9 OQ-61 B1–B5 | Giữ hành vi PR B, đã thử trên CSDL thử | ca của PR B, không đổi | B6 sang đợt D–F |
| M10 câu từ chối nói bước tiếp theo | Đã có mã · đã thử trên CSDL thử | `unlock-092` M10 | Kịch bản 8, 9, 12 đọc câu báo |

Không ca lỗi nào được ghi «đã đóng».

## PR, merge, cổng Codex

- PR: [liberico-ai/ai-together#45](https://github.com/liberico-ai/ai-together/pull/45), nhánh `feat/gv7-unlock-092` vào `libetech-ai-os`. Head lúc merge `4cfaab4`. Mã ở `d80518a`; hai commit sau chỉ đổi tài liệu (thư mục bằng chứng, câu Q-GV7-6).
- Merge: `9cd6a13`, ghim bằng `--match-head-commit`. Hai cha (`532fa41` và `4cfaab4`); cây của merge bằng cây của head. `main` vẫn ở `d23e516`; nhánh mặc định vẫn là `main`.
- **Cổng Codex, một vòng,** trên `1518c3a`. Kết quả: `VERDICT: CHANGES_REQUIRED`, một P0 và ba P1.
  - P0: hoàn tác 028 xoá cả dòng nguồn mang tiền tố `work_request:` mà người vận hành đã ghi trước 028. Đã sửa:
    - 028 dừng trước khi ghi gì nếu gặp dòng như vậy;
    - hoàn tác chỉ xoá dòng sinh lại được từ yêu cầu đã duyệt.
  - Ba P1, đã sửa trong cùng PR:
    - màn hình nhập không gửi tên tệp;
    - tên tệp chưa thuộc khoá chống lặp;
    - BoM Tech ngoài roster không gửi được yêu cầu.
  - Mỗi sửa có ca kiểm đỏ trước trên `1518c3a` (4 dòng `AssertionError`).
  - Codex chưa đọc lại các sửa. Không chạy vòng hai, vì cần lời của người dùng.
- **Một lượt đọc độc lập sau cổng:** một subagent soát bảo mật đọc riêng phần sửa `1518c3a..d80518a`. Kết quả `NO P0`, ba P2.
  - Một P2 là câu sai về nhập bảng ở Q-GV7-6; đã sửa câu (`4cfaab4`, chỉ tài liệu).
  - Hai P2 còn lại (hoàn tác chạy lần hai; kiểm trước của 028 bỏ qua `checked_at`) ghi trong README bằng chứng, không sửa trong PR này.
  - Siết chính sách `batch_write` của 027 để đợt sau.
- Bảng finding đủ (gồm lô sửa trước cổng): `docs/reviews/gv7-unlock-evidence-20261125/README.md`.

## Cổng test trên cây cuối

Chạy một lần trên cây cuối `d80518a`, sau lần sửa mã cuối. Hai commit sau đó không đổi dòng nào ở `src`, `migrations`, `tests`, `scripts`, `deploy`, `package.json`:

| Cổng | Kết quả |
|---|---|
| `npm run typecheck` | thoát 0 |
| `npm run build` | thoát 0 |
| PGlite với coverage | 84 tệp đạt, 15 bỏ qua; 1537 ca đạt, 162 bỏ qua. Coverage trên danh sách tệp: câu lệnh 96,16 %, nhánh 91,89 %, hàm 97,82 %, dòng 97,8 % |
| PostgreSQL 16 (container cục bộ, kể cả diễn tập khôi phục N4) | 99 tệp, 1699 ca đạt, không ca nào bỏ qua |

Plugin và `scripts/` không đổi, nên không chạy `pytest`.

## Bản 0.9.2

- Tệp: `~/Documents/libetech-releases/libetech-ai-os-0.9.2-20261125.tar.gz`, đóng gói từ merge `9cd6a13` trong một worktree sạch bằng `scripts/package-release.py`. 388 tệp. Plugin không đổi (0.3.3).
- SHA-256 của tệp: `a853ad45d65710d0049f7ba06601121d6442d4a10867232d80c71837d84127b4` (tệp `.sha256` nằm cạnh; `shasum -a 256 -c` báo OK).
- `treeSha256`: `b0b03d80021021a67bad09d119e50c40755278a6a9a49ace0ffeaa30ef6d9e12`. `deploy/verify-bundle.py` báo `Bundle verified` trên bản giải nén.
- Runbook: `docs/RUNBOOK-092-20261125.md` (chỉ phần khác 0.9.1). Kịch bản nghiệm thu: `docs/ACCEPTANCE-GV5-20261125.md` bản 1.1 (kịch bản 2 sửa; thêm 8–12).

## Câu mới (không chặn)

Q-GV7-1 tới Q-GV7-6, cuối `docs/OPEN-QUESTIONS.md`:
- Q-GV7-1: ghế đổi người đề xuất lúc duyệt, đối chiếu luật 3/3 «kể cả chia việc giữa ba thành viên BoM»;
- Q-GV7-2: quyền đọc của người nhận việc ngoài membership;
- Q-GV7-3: duyệt hàng loạt chỉ điền chỗ trống;
- Q-GV7-4: phạm vi của BoM Tech;
- Q-GV7-5: ghi chú vận hành sau hai lượt soát (điền bù, `tech-bom.sql` 0–3, gọi lại duyệt cả lô);
- Q-GV7-6: sửa sau cổng Codex. Phân loại tin vẫn cần roster. Nhập bảng ngoài roster chỉ khi là điều phối một dự án; nếu người đó là BoM Tech thì dòng vào dự án khác thành yêu cầu chờ duyệt. Muốn hơn thế thì người vận hành thêm vào roster.

## Vướng còn lại

- Đợt 022 + 023 và bản 0.9.1 chưa có hồ sơ triển khai trong repo. 0.9.2 giả định máy chủ ở schema 001–027 (`docs/RUNBOOK-092-20261125.md` §0).
- Danh sách ba BoM Tech và roster Team Tech là dữ liệu ngoài repo; người vận hành ghi bằng `deploy/tech-bom.sql` và `deploy/tech-roster.sql`.
- Bản nguồn của lần nhập thật: PM chọn ở bước xem trước, và EV-10 đóng bằng lô đầu tiên. Cờ `LIBETECH_WORK_IMPORT` bật khi triển khai.
- Dragon Forge vẫn chờ EV-12 và EV-13.
- Để sau:
  - OQ-61 B6 (gỡ liên kết sai) sang đợt D–F;
  - che ghi chú IBS HI ở Z2 (OQ-62 câu 4 (b)) làm ở đợt sau.
- GV-5 D, E, F chưa bắt đầu; làm tiếp sau bản này.
