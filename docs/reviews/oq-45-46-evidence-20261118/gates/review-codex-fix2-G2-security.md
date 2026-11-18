# Review bảo mật của Task G2 (câu `DRAFT_HELD` trên nháp bị che)

- Phạm vi: diff `ff24901..d9b0974` (`src/server/suggestions.ts`, `tests/suggestions.test.ts`) và báo cáo của builder. Chỉ đọc. Không chạy ca nào: kết quả đỏ và xanh lấy từ log `codex-fix2-G2-*.txt` của phiên chính.
- Quyết định được hiện thực (chép nguyên): «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu». Câu đối chiếu là chữ của phương án 2 (b) (`docs/OPEN-QUESTIONS.md:668`): «chỉ trả mã và lý do giữ».

## 1. P2-1 đã đóng chưa

**Đóng.** Từ `src/server/suggestions.ts:320-326`: khi tập lý do giữ có ít nhất một mã của `MASK_REASONS` (`:38`, kiểu ghim bằng `satisfies MaskReason[]`), câu trả lời chỉ nêu các mã che, cộng `SUBJECT_ORDER_UNVERIFIED` (mã giữ chỗ của hệ thống, không nói gì về nội dung). Các mã mô tả nội dung không còn đi ra: `SOURCE_REQUIRED`, `UNSOURCED_CLAIM`, `TOOL_NOT_ALLOWED`, `NOT_APPROVED_REVISION`, `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH`, `SUBJECT_*`.

Phép thử «có mã che trong tập giữ» so với «một lần đọc che nháp với người này»:

- **Có ngữ cảnh.** Hai bên tính cùng các mã từ cùng các hàm, dưới cùng người, trong cùng giao dịch:
  - `checkSkillOutput` cho ba mã `VISIBILITY`, kể cả `SCHEMA_INVALID`;
  - `ctx.pointerOnly`;
  - `threadHasHiddenText`;
  - `projectHasHiddenText`.
  Bước giữ lấy đủ tập của cổng, nên chứa mọi mã che mà `present` (`:200-219`) sẽ thêm. Hai bên **tương đương**, trừ khi trạng thái đổi giữa hai lần dựng.
- **Không có ngữ cảnh.** Lần đọc che bằng `ENTITY_NOT_FOUND` (và `SCHEMA_INVALID` nếu giá trị không qua lược đồ). Bước giữ có `ENTITY_NOT_FOUND` (`:304`), nên được coi là bị che. Câu trả lời có thể **ít hơn** `maskReasons` của `list` một mã, `SCHEMA_INVALID`: khi không có ngữ cảnh, `checkSkillOutput` không chạy. Đó là một tập con, không lộ gì (P3-1).
- **Chỉ `MANIFEST_MISMATCH` / `VALUE_HASH_MISMATCH`.** Hai mã này không che lúc đọc: lần đọc trả `value` và `valueHash`. Nêu đủ mã là đúng, vì người này đang được xem nội dung.
- **Trạng thái đổi giữa chừng.** Nếu lớp che phủ xuống, câu chỉ nêu mã che: an toàn. Nếu lớp che gỡ ra, câu nêu đủ mã cho một nháp mà lúc đó người này đã được xem. Không trường hợp nào lộ hơn những gì `list` sẽ trả vào lúc đó.

Vậy trên một nháp bị giữ vì một mã che, câu trả lời của lệnh xác nhận **không mang gì về nội dung ngoài những gì `list` hiện cho dòng đó**, cộng mã giữ chỗ.

## 2. Bản sửa có mở ra gì không

- **Danh sách rỗng: không xảy ra.** Nhánh bị che giữ lại ít nhất mã che đã làm nó thành «bị che». Nhánh còn lại nêu đủ tập, mà tập không rỗng.
- **Hành vi không đổi.** Không dòng nào của dịch vụ rẽ nhánh theo nội dung câu `DRAFT_HELD`. Mọi phép kiểm vẫn chạy, cùng mã lỗi, cùng trạng thái HTTP 422, cùng chỗ ném. Thứ tự các câu trả lời không đổi:
  - quyền → đã quyết → hash (chỉ khi không bị che) → lý do → giữ → hash → bản đề xuất → dòng quyết định.
  Người bị che chỉ mất phần chẩn đoán. Khi lớp che hết, họ đọc lại thì thấy đủ mã.
- Câu giữ của F5 (`:338`) chỉ nêu `POINTER_ONLY_PROJECT`: đã đúng luật mới.

## 3. Các ca đã đổi và hai helper

- **H8** ghim đúng tên ca. Ở (i) và (ii), câu giữ là **đúng** tập `maskReasons` mà `list` trả cho dòng đó (cộng mã giữ chỗ với nháp ứng viên), có đối chứng không che cho thấy `SUBJECT_CHANGED` có mặt khi không bị che. (iii) ghim `MANIFEST_MISMATCH` bị bỏ khi `ENTITY_NOT_FOUND` giữ nháp. Ca đỏ được: bỏ bộ lọc thì `heldOnly` (so đúng cả danh sách) đỏ.
- **H7, nhánh hash sai** ghim `REVISION_CONFLICT` và không ghi gì. Nhánh này xanh cả trên mã cũ, như builder đã nói: nó là ca phủ, không phải ca đỏ. Đóng P3-3 của review trước.
- **`withExtraSources` / `heldBySubjectOnly`.** Helper ghim ba điều:
  1. với ngữ cảnh được lái, `list` không còn mã che nào;
  2. lệnh xác nhận bị giữ bởi **đúng** các mã của luật mốc (qua `heldOnly`);
  3. có đúng hai lần dựng ngữ cảnh, tức cả hai đều được lái.
  Luật mốc tự đọc CSDL (`subjectReasons`, `:117-131`), không qua ngữ cảnh. Gỡ luật đó thì lệnh được xác nhận và ca đỏ; nới luật (ví dụ nhận mã viết hoa, hay nhận bản của tài liệu khác làm mốc) thì mã đổi và ca đỏ. Khối `finally` đưa bộ dựng về bản thật. Ba ca đã đổi vẫn cho thấy luật mà tên ca nêu.
- **V2.** Tên ca thêm «— on a draft that no mask reason holds», nhưng mục 4 (dòng 2), 5 và 6 của chính ca đó kiểm nháp **bị che** và đòi danh sách chỉ có mã che. Lời khẳng định đúng, tên ca hẹp hơn nội dung (P3-2).

## Phát hiện

| # | Mức | Vị trí | Nội dung | Sửa |
|---|---|---|---|---|
| P3-1 | P3 | `src/server/suggestions.ts:302-307`, `:322-323` | Khi không dựng được ngữ cảnh, câu giữ có thể thiếu `SCHEMA_INVALID` mà `list` hiện cho cùng dòng: câu giữ là tập con của `maskReasons`, không phải đúng tập đó. Không lộ gì; chỉ lệch chẩn đoán | Chấp nhận. Hoặc ở bước giữ thêm `SCHEMA_INVALID` khi `outputFits`/`safeParse` hỏng, kể cả khi không có ngữ cảnh |
| P3-2 | P3 | `tests/suggestions.test.ts` (V2, tên ca) | Tên «— on a draft that no mask reason holds» không khớp mục 4 (dòng 2), 5, 6 của chính ca, vốn kiểm nháp bị che | Đổi tên thành «… — every code when no mask reason holds, the mask reasons otherwise», hoặc dời ba mục đó sang H8 |

Không có P0, P1 hay P2.

## 4. Sau G1 và G2, bảng D còn gì

Không còn mục nào mà một người đọc chặt câu «chỉ trả mã và lý do giữ» xếp P0 hay P1. Thứ còn lại tới tay người bị che:

- `maskReasons` và cùng các mã đó trong câu giữ: đúng chữ «mã».
- Siêu dữ liệu của dòng (`id`, `skill`, `entityType`, `entityId`, `createdAt`, `manifestHash` chỉ khi trùng manifest đang hiệu lực, `decision`, `total`): không phải nội dung.
- Kênh thích ứng qua trạng thái dự án (P3-1 của review G1): người ghi được tài liệu đổi cửa sổ ngữ cảnh rồi nhìn `SOURCE_OUT_OF_CONTEXT` đổi. Chỉ lộ mã, nay chỉ còn qua mã che.
- Thời gian theo cỡ `value`: cỡ tối đa 32 KiB, chênh vài micro giây.

Tất cả là P3.

## Chưa kiểm được

- Không chạy ca nào, không chạm CSDL.
- Chưa kiểm bằng phép chạy rằng hai lần dựng ngữ cảnh của một lệnh luôn cho cùng lớp che khi không có ghi đồng thời. Đây là lập luận trên mã.

VERDICT: READY FOR GATE
