# Giao dịch đã huỷ không được báo «thành công» — `COMMIT` trả `ROLLBACK` không lỗi · 20/11/2026

PR riêng vào `libetech-ai-os` (không vào `main`; số PR ghi ở roadmap). Việc này là phát hiện **P3 (có từ trước)** của review bảo mật tầng 1 cho PR #31 (N1–N3), ghi ở `docs/DELIVERY-018-pre-023-n1-n3-20261120.md` (bảng «Review», dòng P3 thứ hai) và ở `docs/RUNBOOK-PRE-023-N1-N3.md` mục 1, việc còn lại (b): «một lần ghi có thể thành công mà không ghi gì». Làm sau khi PR #31 đã merge (`a4a3542`); xây trên bản `transaction()` của #31.

**Z4 chưa bật và không được bật bởi PR này. 022 và 023 chưa áp ở đâu ngoài CSDL thử. Không triển khai d1-ai1, không chạm gateway thật, không chạy gì trên dữ liệu thật, không gửi tin vào nhóm thật.**

## Lỗi

Trong `pooledDatabase().transaction()` (`src/server/db.ts`): một câu lệnh trong callback lỗi, callback bắt lỗi rồi trả về bình thường; giao dịch đã bị huỷ; `COMMIT` trên giao dịch đã huỷ **không báo lỗi** mà trả lệnh `ROLLBACK`. Mã cũ bỏ qua kết quả `COMMIT`, nên `transaction()` **resolve như thành công** trong khi không có gì được ghi: người gọi tin rằng đã ghi, dữ liệu thì mất, không dấu vết.

## Đã làm

| Tệp | Việc |
|---|---|
| `src/server/db.ts` | Sau `COMMIT`, nếu `result.command !== 'COMMIT'` thì ném `TransactionNotCommittedError` (câu cố định «The transaction was rolled back and nothing was written.»; không tham số, không `cause`, không `code`, không chữ nào của CSDL). Sau câu trả lời ấy phiên đã rảnh, nên **không gửi thêm `ROLLBACK`** (cờ `open` chỉ tắt sau khi câu trả lời `COMMIT` đã về) và kết nối **trả về pool bình thường** (`release(undefined)`), không bị huỷ. Mọi đường khác không đổi: callback ném (ROLLBACK, lỗi của người gọi được giữ), `BEGIN` lỗi, `COMMIT` tự ném, server cắt phiên (`broken`, PR #31). `pgliteDatabase(pg)` (mới) là chỗ duy nhất bọc PGlite thành `Database`: `embeddedDatabase` và bộ thử cùng dùng nó; nó đổi lỗi riêng của PGlite thành cùng `TransactionNotCommittedError`, để hai engine cho một lỗi |
| `tests/slice1-db.ts` | Dùng `pgliteDatabase` thay bản bọc chép tay (hai bản chép giống nhau không còn) |
| `tests/transaction-commit.test.ts` (mới) | 9 ca: 7 chạy trên cả PGlite và PostgreSQL thật, 2 chỉ PostgreSQL thật |
| `tests/thread-order-concurrency.test.ts` | Ca **N5** là **người gọi duy nhất dựa vào việc im lặng huỷ** (xem bảng người gọi): sửa để kết thúc giao dịch bằng cách ném một giá trị canh, không bằng cách nuốt lỗi |

## Điều đã đo (#fact; PostgreSQL 16 thật trong container thử, dữ liệu tổng hợp; PGlite 0.5.15)

1. **Tiền đề đúng**: trên PostgreSQL thật, `COMMIT` sau một câu lệnh lỗi trả `command = 'ROLLBACK'`, không lỗi (ca «premise», dùng một `pg.Client` trần).
2. **Mã cũ trên PostgreSQL thật: `transaction()` resolve** («the transaction resolved although nothing was written», `red-before-native.txt`).
3. **Điều chỉnh so với lời giao việc: PGlite KHÔNG resolve.** PGlite 0.5.15 tự ném `TransactionAbortedError` («Transaction was rolled back instead of committed», `code 25P02`) khi `COMMIT` trả `ROLLBACK` (đọc trong mã của gói; ca đỏ trên PGlite cũng cho thấy câu ấy). Ca đỏ trên PGlite vì thế đỏ **chỉ vì lỗi không phải câu cố định và có `code`**, không vì một lần ghi mất. Hệ quả cho nghiệm thu: trước sửa, **chỉ PostgreSQL thật che lỗi này**; một ca thử nuốt lỗi trong giao dịch sẽ đỏ trên PGlite nhưng xanh trên PostgreSQL thật — nên chỉ ca chỉ-chạy-trên-PostgreSQL-thật mới che được, và bản quét tìm đúng một ca như vậy (N5).
4. **Đỏ trước khi sửa, trên cùng tệp thử cuối** (mã cũ của `db.ts` và `slice1-db.ts`, tệp thử cuối): PGlite **4 đỏ / 3 xanh / 2 bỏ qua**; PostgreSQL thật **5 đỏ / 4 xanh**; mọi ca đỏ là `AssertionError`, **0** lần «timed out»/«PGlite is closed» (`red-before-pglite.txt`, `red-before-native.txt`). Các ca xanh cả trước lẫn sau là ca **bảo vệ**: giao dịch thành công vẫn commit; savepoint chữa lỗi vẫn commit; callback tự ném thì lỗi của nó được giữ; trên PostgreSQL thật thêm ca «premise» (tiền đề, mục 1).
5. **Xanh sau khi sửa, trên cây cuối**: tệp mới **9/9** trên PostgreSQL thật, **7 đạt + 2 bỏ qua** trên PGlite (`final-new-file-*-verbose.txt`, mỗi ca một dòng có tên).
6. **Lượt chạy nháp trước khi sửa N5**: toàn bộ bộ thử trên PostgreSQL thật có **đúng 1 ca đỏ** — N5 của `thread-order-concurrency.test.ts`, bằng `TransactionNotCommittedError` (`draft-n5-failure.txt`); không ca nào khác dựa vào việc im lặng huỷ. Sau khi sửa N5: xanh (`xanh, xem mục 7`).
7. **Bộ thử đầy đủ trên cây cuối** (sau mọi sửa, một lượt mỗi bên, không chạy hai lượt cùng lúc): **PostgreSQL 16 thật, cả hai login (quản trị và login web hạn chế): 84 tệp đạt, 1 bỏ qua, 1466 ca đạt, 17 bỏ qua, 0 đỏ (526 giây)**. **PGlite (wasm): 71 tệp đạt, 14 bỏ qua (chỉ chạy trên PostgreSQL thật), 1333 ca đạt, 150 bỏ qua, 0 đỏ (537 giây)**. `typecheck`: `tsc --noEmit` thoát 0 (`final-typecheck.txt`). `build`: `next build` biên dịch thành công và in đủ bảng tuyến (`final-build.txt`). Tệp bỏ qua: phần diễn tập phục hồi của N4 (cần cờ riêng; không thuộc PR này). Cả hai lượt chạy: **0** lần «timed out»/«PGlite is closed». Chín cảnh báo `DeprecationWarning` của `pg` (gọi `client.query()` khi kết nối đang bận) ở lượt PostgreSQL thật có **cùng số** ở lượt của DELIVERY-018 (`docs/reviews/pre-023-evidence-20261120/final-suite-native.txt`), nên không do PR này.

## Người gọi — từng chỗ bắt lỗi của một câu lệnh bên trong giao dịch rồi đi tiếp

Tôi lập danh sách bằng `grep` trên `src/`, `scripts/`, `tests/`; **một ghế review bảo mật mới lập danh sách riêng** (theo báo cáo của ghế: grep mọi chỗ gọi `transaction`/`scoped`/`intakeScoped`/`scope`/`SAVEPOINT`/`BEGIN` và một lượt quét cây cú pháp trên 242 tệp `.ts`/`.tsx`/`.mjs`; tôi không chạy lại lượt quét ấy) rồi mới so; hai danh sách khớp ở kết luận.

| Chỗ | Làm gì | Bây giờ |
|---|---|---|
| `src/server/outbox.ts` `report()` (:170–221) — chỗ duy nhất trong `src/` dùng savepoint | mỗi biên nhận một `SAVEPOINT`; chỉ bắt `AppError` `LEASE_INVALID`/`RECEIPT_CONFLICT`, rồi `ROLLBACK TO` + `RELEASE`; lỗi khác ném tiếp | **không đổi, vẫn commit**: savepoint đã chữa giao dịch, `COMMIT` trả `COMMIT` (ca «savepoint» của tệp mới giữ đúng điều này) |
| `src/server/doc-approval-proposals.ts` (:100, :159), `document-review.ts` (:304), `review-delegations.ts` (:148, :177), `document-commands.ts` (:12) | bắt lỗi CSDL (`23505`, `LTR01/02/03`, `APPROVERS_NOT_READY`) để **đổi thành `AppError` rồi ném** | không đổi: ném, giao dịch rollback |
| `src/server/suggestions.ts` `contextFor` | bắt `AppError` `SCOPE_DENIED`/`INVALID_INPUT` của `buildSkillContextIn` rồi trả `null` | không đổi: các `AppError` ấy đến từ logic ứng dụng **sau** các câu lệnh thành công (`skill-context.ts` không có `catch`), giao dịch không bị huỷ, vẫn commit |
| `suggestions.ts` (`submitDraft`, :161), `decisions.ts` (:80), `review-page.ts`, `identity.ts` (:76, kiểm Argon2), mọi route, trang và `*-http` | `catch` **bên ngoài** giao dịch, quanh cả lời gọi dịch vụ | `TransactionNotCommittedError` sẽ thành `500` cố định có mã tham chiếu (`failure()` chỉ ghi `errorType`), hoặc trạng thái lỗi của trang |
| `identity.scope`, `intakeScoped`, `aiScoped`, `scoped`, `seed`, `document-projector`, `evidence-projector`, `sync-document-templates`, `native-verification`, `spec003-native-verify` và mọi phương thức dịch vụ khác mở `scoped()` | không có `try/catch` nuốt lỗi | không đổi: lỗi lan ra, không có thành công im lặng |
| `scripts/import-pilot.ts`, `import-team-tech-catalog.ts`, `configure-account-approvers.ts` — `BEGIN`…`COMMIT` **trần**, không qua `transaction()` | không có `catch` bên trong: mọi lỗi đi vào `ROLLBACK` rồi ném | **không bị lỗi này**, nhưng cũng **không kiểm lệnh của `COMMIT`**: chưa sửa (ngoài phạm vi; xem «Còn mở») |
| Ca thử dùng savepoint (`intake.test.ts`, `z4-schema.test.ts`, `z4-pointer-guard.test.ts`, `slice2-fixtures.ts`, `review-schema.test.ts`, `thread-order-concurrency.test.ts` N4 và hai chỗ khác, `session-timeouts.test.ts`) | savepoint chữa, hoặc luôn kết thúc bằng ném | không đổi |
| Ca thử bọc **cả** lời hứa của giao dịch (`refusal(as(...))`, `rejects.toThrow` trên `scoped(...)`) | chính việc bị từ chối là cái được thử | nhận lỗi mới đúng chỗ đã chờ một lời từ chối |
| **`tests/thread-order-concurrency.test.ts` ca N5** | trong `asIntake(...)` bắt lỗi RLS (`42501`) của một câu lệnh bị từ chối, ghi câu trả lời rồi **trả về bình thường**: giao dịch đã huỷ, `COMMIT` im lặng trả `ROLLBACK` | **là người duy nhất dựa vào im lặng huỷ** (đỏ với `TransactionNotCommittedError` ở lượt nháp). **Đã sửa, không che**: sau khi ghi câu trả lời, ca **ném một giá trị canh** và bắt đúng giá trị ấy bên ngoài. Câu lệnh KHÔNG bị từ chối vẫn không ném, nên vẫn commit và vẫn bị ca bắt bằng câu trả lời «stored» và phép đếm `positionsBefore+2`. Ca vẫn thử đúng điều N5 nói: vai intake của dự án khác bị RLS từ chối ngay (`42501`), không ai chờ khoá, không số nào được ghi cho câu bị từ chối |

## Review

Một ghế review bảo mật mới (tầng 1, chỉ đọc, không chạy thử): **không P0, P1, P2; GO** (khuyến nghị). Đường mã `transaction()` được kiểm theo từng nhánh (callback trả; callback ném; `BEGIN` lỗi; `COMMIT` trả `ROLLBACK`; `COMMIT` tự ném; server cắt phiên): cờ `open` không bao giờ bỏ sót một `ROLLBACK` cần có, vì nó chỉ tắt sau khi câu trả lời `COMMIT` đã về, lúc phiên đã rảnh. Lỗi không mang gì của CSDL; nhánh PGlite bỏ hẳn đối tượng lỗi của PGlite (`code 25P02`, câu truy vấn) và dựng lỗi mới.

| Phát hiện | Xử lý |
|---|---|
| P3-1 ca savepoint không khẳng định câu lệnh thật sự lỗi | **Đã đóng**: cờ `healed` được đặt trong `catch` và kiểm đúng |
| P3-2 ca «kết nối trả về sạch»: `state='idle'` một mình có thể sai nhịp (phiên vừa bị huỷ vẫn có thể hiện `idle` trong vài mili giây); cái thật sự bắt được việc huỷ kết nối là so `pg_backend_pid()` trước và sau; câu «không gửi thêm ROLLBACK» trong chú thích là ý của mã, không phải điều được thử (một `ROLLBACK` thừa chỉ sinh cảnh báo) | **Đã đóng một phần**: chú thích của ca nói đúng cái nào bắt cái gì. Câu «không gửi thêm ROLLBACK» **vẫn không có ca thử** và đây là chỗ nói rõ |
| P3-3 ba script `BEGIN`…`COMMIT` trần bỏ qua lệnh của `COMMIT` rồi in «imported/applied» | **Còn lại, ghi ở «Còn mở»**: không chạm được hôm nay (không script nào có `catch` bên trong), nhưng nên kiểm lệnh hay chuyển sang `transaction()` |
| P3-4 nếu `COMMIT` tự ném (ràng buộc hoãn, `40001`) thì `ROLLBACK` vẫn được gửi trên giao dịch đã hết | Không làm gì: chỉ là cảnh báo «no transaction in progress», như trước khi sửa |
| Hygiene repo công khai | Không đường dẫn máy, tên tài khoản, mật khẩu hay chuỗi dạng id thật; chỉ có ba UUID toàn số không trong ca `scoped()`, cùng kiểu các tệp thử khác |

## Đã chệch khỏi quy trình lát — nói rõ

- Skill `slice` được nạp **với số lát để trống** (đây là việc sửa sau PR #31, không phải lát 1–5): dùng theo tỉ lệ như lời giao việc. **Không có kế hoạch riêng** (`docs/plans/`) và **không có cổng Codex**: thay đổi nhỏ (một tệp mã, hai tệp thử, tài liệu), Chairman không yêu cầu; thay bằng một ghế review bảo mật mới. Chạy cổng Codex được nếu Chairman muốn.
- Ca thử viết **trước** mã: hai lượt đỏ (PGlite 4, PostgreSQL thật 5, toàn `AssertionError`), rồi chạy lại trên đúng tệp thử cuối với mã cũ (số ở mục «Điều đã đo» 4).

## Còn mở — không thuộc PR này

1. Ba script `BEGIN`…`COMMIT` trần (`import-pilot`, `import-team-tech-catalog`, `configure-account-approvers`): kiểm `result.command === 'COMMIT'` hoặc chuyển sang `transaction()` (P3-3). Không phát hiện đường lỗi nào hôm nay.
2. Các việc còn lại của N1 (runbook mục 1, (a), (c), (d)) và N2/N3/N4/N5, kế hoạch đợt 022 + 023, Z4: không đổi (xem DELIVERY-016, 017, 018).

## Bốn mức

| Mức | Trạng thái |
|---|---|
| Đã có mã | **Có**: `src/server/db.ts` (`TransactionNotCommittedError`, kiểm lệnh `COMMIT`, `pgliteDatabase`) |
| Đã thử trên CSDL thử | **Có**: PostgreSQL 16 thật (tệp mới 9/9; bộ đầy đủ ở mục «Điều đã đo» 7) và PGlite |
| Đã triển khai / đã dùng thật | **Chưa**: không máy chủ, dữ liệu hay gateway thật nào |
| Đã nghiệm thu | **Chưa.** Người làm không tự nghiệm thu |

## Bằng chứng

`docs/reviews/commit-aborted-evidence-20261120/` (nhật ký đã gỡ đường dẫn máy; `README.md` ở đó nói mỗi tệp là gì và băm của bốn tệp mã/thử của cây cuối). Tên tệp có «draft» là của lượt nháp trước khi sửa N5, không phải của cây cuối.
