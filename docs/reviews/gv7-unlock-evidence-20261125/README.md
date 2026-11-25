# Bằng chứng GIAO VIỆC 7 — bản 0.9.2 «mở khoá» (25/11/2026)

Nhánh `feat/gv7-unlock-092`, trên `532fa41` (merge của bản 0.9.1 cộng tài liệu). Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`. Log không chứa dữ liệu team: chỉ dữ liệu mẫu của bộ test.

Các quyết định mà bản này làm theo là của phiên điều phối (Cowork) theo uỷ quyền Chairman 25/11/2026 17:48; Chairman có thể đổi. Lời Chairman và các quyết định nằm ở khối «GIAO VIỆC 7» cuối `docs/OPEN-QUESTIONS.md`.

## Đỏ trước, xanh sau

- `logs/red-first-cut.txt`: lượt đầu, trên mã của `532fa41` cùng `tests/unlock-092.test.ts`: 24 ca, **22 ca hỏng, 18 dòng `AssertionError`**. Bốn ca còn lại hỏng vì mã cũ chưa có thứ ca kiểm cần: một `TypeError` (chưa có bảng cấp quyền nên ca không lấy được dòng), hai lần mã cũ ném câu từ chối «Cần phiên làm việc có phạm vi dự án.» (người chưa có membership), một `ENOENT` (chưa có `deploy/tech-bom.sql`). Hai ca còn lại xanh ngay trên mã cũ (log không ghi tên ca xanh).
- `logs/red-before-sweep-fixes.txt`: lô sửa sau hai lượt soát nội bộ và một lượt review tự động. Mã cũ `6e3de00` (một worktree nháp) cùng các ca mới: 3 tệp, **14 ca hỏng, 14 dòng `AssertionError`**.
- `logs/red-revise-grant.txt`: ca «revise» viết lại sau lần đỏ trên (lần đó nó hỏng vì lỗi của chính ca kiểm: lược đồ `revise` đòi mã người nghiệm thu). Chạy lại riêng trên `6e3de00`: 1 ca hỏng, 1 dòng `AssertionError`; lỗi là `P0001` của trigger cấp quyền, vì giao dịch `revise` không đặt `app.person_id`.
- Sau lô sửa, ba tệp đó xanh: 91/91 ca.

## Lô sửa trước cổng Codex

Hai lượt soát nội bộ và một lượt review tự động trên `6e3de00`. Mọi mục rủi ro rò rỉ được sửa trước khi gửi cổng, không ghi lại để sửa sau. Ca kiểm nằm ở `tests/unlock-092.test.ts` (khối «Sau soát»), trừ chỗ ghi khác.

| Mức | Chỗ | Finding | Đã làm | Ca kiểm |
|---|---|---|---|---|
| P1 | `work-requests.ts` `requestScope`, `context`, `decideMany`; chính sách `request_read`/`request_decide` | Phạm vi của BoM Tech nới ra cả tenant: đọc được việc, dịch vụ, audit của dự án ngoài membership | `requestScope` không nới nữa. Chính sách chỉ hỏi `work_request_seat()`. Lúc duyệt, chỉ giao dịch đó mở đúng dự án của yêu cầu (`decidingIn`) | `F6 a BoM Tech reads no work, service or audit row…`, `F6 the decision screen of a BoM Tech holds only…` |
| P1 | `intake_link_allowed()` | Là BoM Tech thì gắn được tin nhắn vào việc ở dự án ngoài membership | Giữ luật 025: thành viên không phải `viewer`, hoặc ghế của chính dự án | `F6 being a BoM Tech does not let a person link a message…` |
| P1 | `decideIn`; guard `work_access_grants` | BoM Tech chưa có membership tự giao việc cho mình rồi tự cấp quyền | Dịch vụ từ chối `SELF_GRANT`, câu báo nói nhờ người khác giao. CSDL từ chối người cấp trùng người nhận | `SELF_GRANT a BoM Tech with no membership…`, `SELF_GRANT the database refuses…` |
| P1 | guard `work_access_grants` | Dòng cấp quyền trỏ vào một quyết định cũ vẫn được ghi | Dòng chỉ ghi được trong chính giao dịch của quyết định (`decided_at`/`created_at = now()`) | `grant a grant is written only in the transaction…` |
| P1 | `service.ts` revise | Giao dịch `revise` không đặt `app.person_id`, nên trigger từ chối dòng cấp quyền (P0001) | Đặt `app.person_id` trước khi ghi dòng cấp quyền | `revise a coordinator makes a roster member…` (đỏ riêng: `logs/red-revise-grant.txt`) |
| P1 | `identity.ts` | Dòng cấp quyền mở dự án mãi, kể cả khi phiếu 3/3 đã chuyển việc đi | Lúc đăng nhập chỉ tính dòng mà người đó còn giữ việc (người thực hiện, hoặc chủ một phần của biên nhận mới nhất) | `live a grant counts at sign-in only while…` |
| P2 | guard `bom_sources`, rollback 028 | `LIKE 'work_request:%'` coi `_` là ký tự đại diện | Dùng `starts_with` | `M4 a source row is a request row only by its literal prefix…` |
| P2 | guard `bom_sources` | Một login có quyền runtime mà không `SET ROLE` vẫn ghi được dòng nguồn khác | Guard kiểm `pg_has_role(…,'libetech_runtime','USAGE')`, trừ superuser | `M4 a login holding the runtime privileges…` |
| P2 | `decideMany` | Chạy lại lô sau khi dự án thêm dịch vụ thì trả lời khác lần đầu; khoá chạy lại băm cả dữ liệu đọc từ CSDL | Lô lấy yêu cầu còn chờ hoặc do chính người đó đã duyệt. Khoá chạy lại chỉ băm dữ liệu client gửi | `M7 the same bulk call again gets the stored answers…`; `tests/sheet-import.test.ts` `M7 a whole import batch is approved in one call…` |
| P2 | `deploy/tech-bom.sql` | Script đòi đúng ba người, nên không ghi được khi chưa đủ người và không gỡ được | Nhận 0–3 người khác nhau; danh sách rỗng gỡ hết | `M5 the operator script sets zero to three BoM Tech…` |
| P2 | danh sách yêu cầu | Số tổng của BoM Tech đếm yêu cầu của mọi dự án trong tenant | Giữ nguyên: số tổng đếm đúng những yêu cầu người đó đọc được. Ghi ở Q-GV7-4 | — (không đổi mã) |

## Xanh trên cây cuối `d80518a`

Chạy một lần sau lần sửa mã cuối (sau vòng Codex). 162 ca bỏ qua trên PGlite là các ca chỉ chạy khi có PostgreSQL thật; lần chạy PostgreSQL chạy cả 1699.

| Log | Lệnh | Kết quả |
|---|---|---|
| `logs/typecheck.log` | `npm run typecheck` | thoát 0 |
| `logs/build.log` | `npm run build` | thoát 0 |
| `logs/pglite-coverage.log` | `npx vitest run --coverage` (PGlite) | 84 tệp đạt, 15 bỏ qua (99); **1537 ca đạt, 162 bỏ qua (1699)**; trên danh sách tệp của `vitest.config.ts`: câu lệnh 96,16 %, nhánh 91,89 %, hàm 97,82 %, dòng 97,8 % |
| `logs/native.log` | `npx vitest run` trên PostgreSQL 16 (container cục bộ, CSDL riêng của phiên) | **99 tệp đạt; 1699 ca đạt**, không ca nào bỏ qua. `SLICE1_PG_CONTAINER` đặt tên container, nên diễn tập khôi phục N4 (`tests/restore-rehearsal.test.ts`, `pg_dump`/`pg_restore` thật) cũng chạy |

Bản này không thêm module server mới. Mọi module server đã đổi nằm trong danh sách `coverage.include`, trừ `src/server/types.ts` (chỉ có kiểu), nên dòng từng tệp ở `logs/pglite-coverage.log` đã đo chúng; không cần `coverage-new-modules.log` như GV-5 C. Tệp giao diện đã đổi (`src/app/…`, `src/components/…`) không nằm trong danh sách, như các bản trước; chúng được kiểm bằng `tests/work-requests-ui.test.tsx` và `tests/work-import-ui.test.ts`.

Plugin bot không đổi (0.3.3) và `scripts/` không đổi, nên không chạy lại `pytest`.

## Cổng Codex — một vòng

- `codex-context-round-1.md`: khối ngữ cảnh gửi kèm diff mã (`src`, `migrations`, `deploy`, `tests`, `vitest.config.ts`, `package.json`, so với `532fa41`; 232 592 ký tự cả lời nhắc).
- `codex-round-1.md`: kết quả nguyên văn. Dòng đầu: `VERDICT: CHANGES_REQUIRED`.
- Vòng chạy trên cây `1518c3a`. Bản ghi hội thoại của Codex không commit.
- Theo giao việc: một vòng, chỉ P0 chặn. Có một P0, nên sửa trước khi merge. Ba P1 nhỏ, và hai trong số đó quyết định M6 và M8 câu 6 có chạy thật trên web hay không, nên sửa luôn trong PR này. Không chạy vòng Codex thứ hai: cần lời của người dùng.

| Mức | Chỗ | Finding | Đã làm | Ca kiểm |
|---|---|---|---|---|
| P0 | `migrations/rollback/028_unlock_092.sql` | Hoàn tác xoá mọi dòng `bom_sources` mang tiền tố `work_request:`, kể cả dòng người vận hành đã ghi trước 028 | 028 dừng trước khi ghi gì nếu một dòng mang tiền tố mà không yêu cầu đã duyệt nào sinh ra nó, và nói cách làm: đổi tên dòng đó. Hoàn tác chỉ xoá dòng sinh lại được từ yêu cầu đã duyệt; dòng khác mang tiền tố thì hoàn tác dừng và dòng giữ nguyên | `tests/migrations-rollback.test.ts` `rollback 028 deletes only the request source rows it can derive again…` |
| P1 | `src/components/work-import.tsx` | Màn hình nhập không gửi tên tệp, nên lô nhập trên web luôn thiếu `file_name` | Màn hình gửi tên tệp đã chọn (`importEnvelope`), đã bỏ dấu đường dẫn và ký tự điều khiển, tối đa 255 | `tests/work-import-ui.test.ts` `M8 câu 6: the request body of the import screen carries…` |
| P1 | `src/server/sheet-import.ts` | Gọi lại lô nhập với cùng mã thao tác nhưng khác tên tệp vẫn trả biên nhận cũ | Tên tệp thuộc khoá chống lặp; khác tên là `IDEMPOTENCY_CONFLICT` | `tests/sheet-import.test.ts` `M8 câu 6: the same request key with another file name…` |
| P1 | `src/server/work-requests.ts`; `work_request_filer` (028) | BoM Tech không có trong roster thì không gửi được yêu cầu | Khi gửi yêu cầu, BoM Tech tính là thành viên Team Tech, ở cả dịch vụ và hàm `work_request_filer`. Hoàn tác 028 khôi phục thân hàm của 024. Phân loại tin và nhập bảng vẫn cần roster (Q-GV7-6) | `tests/unlock-092.test.ts` `M6 a BoM Tech who is neither on the roster nor holds a membership…` |

Các sửa trên làm sau vòng Codex, nên Codex chưa đọc lại. Cổng test chạy lại trên cây cuối.

### Đỏ trước khi sửa theo Codex

- `logs/red-after-codex.txt`: mã cũ `1518c3a` (một worktree nháp) cùng bốn ca mới ở bản cuối: 4 tệp, **4 ca hỏng, 4 dòng `AssertionError`**.
- Lần chạy đỏ đầu tiên (trên chính cây này, trước khi sửa mã) cho cùng kết quả. Sau lần đó, ca hoàn tác thêm một khẳng định về thân `work_request_filer`; log ở trên chạy với bản đã thêm.

Mức: **đã có mã · đã thử trên CSDL thử**. Chưa triển khai, chưa nghiệm thu với team.
