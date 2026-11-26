# Kế hoạch GIAO VIỆC 5 · hạng mục D — Bot nói đúng nguyên nhân; che ghi chú IBS HI ở Z2

Ngày 26/11/2026 · nền `libetech-ai-os` @ `8d1e7a4` (0.9.2) · PR 4.

- **D:** tệp giao việc 5.
- **Che Z2:** OQ-62 câu 4 (b). Phiên điều phối (Cowork) chọn theo uỷ quyền Chairman 25/11/2026 17:48; Chairman có thể đổi. Tệp giao việc 7 ghi «làm ở đợt sau»; đợt sau là PR này.

## 1. Hiện trạng (#fact, đọc mã)

1. **Một mã cho bốn nguyên nhân.** `SCOPE_DENIED` được ném ở ba chỗ của `src/server/bridge.ts`:
   - dòng 30: nguồn hội thoại không khớp loại hội thoại (403);
   - dòng 34: giao giữa dự án của người hỏi và dự án của hội thoại là rỗng (403). Chỗ này gộp ba trường hợp:
     - (i) nhóm không gắn dự án nào (gồm nhóm chung Team Tech và nhóm chưa được ghi sổ);
     - (ii) nhóm gắn dự án mà người hỏi không thuộc;
     - (iii) tin nhắn riêng của một thành viên Team Tech chưa thuộc dự án nào (đăng nhập được từ 0.9.2, M6);
   - dòng 36: không thấy hồ sơ đúng SHA (**404**, vẫn mang mã `SCOPE_DENIED`).
2. **Bot trả mã trơ.** `safe_error` (`bot-plugin/__init__.py`) chỉ giữ chuỗi mã, bỏ câu của máy chủ. `/libetech-link` và `/libetech-check` trả đúng mã đó.
3. **Công cụ đọc để mô hình tự giải thích.** `libetech_os_read` trả `{ok:false,error:CODE}`. Mô tả công cụ ghi «chat/project scope», nên mọi lỗi dễ bị mô hình giải thích thành «phạm vi» (#inference cho ca (a)).
4. **Chữ `unauthorized` không có trong mã** của repo này, và cũng không có trong plugin priority1.
   - Nguồn có thể (#hypothesis, chưa chứng minh): lớp chặn người dùng của gateway Hermes; lỗi 401 của máy chủ hoặc cầu nối được mô hình nói lại bằng tiếng Anh; 401 của Telegram.
   - Ca (a) vì vậy **chưa xác định được nguyên nhân** (EV-03, EV-16).
5. **Ca (b)** `SCOPE_DENIED`: mã không phân biệt được bốn trường hợp ở mục 1, nên không biết ca thật là trường hợp nào (EV-04, EV-17). Phép thử ngày 10/11 ở nhóm không gắn dự án là từ chối đúng thiết kế.
6. **Tin gọi bot bị máy chủ từ chối lúc tiếp nhận** (403, 409, 413, 422) được chuyển vào tệp dead-letter và không có câu trả lời (`submit_event`).
   - Nhóm pool im lặng là cố ý (kế hoạch B §3.2).
7. **Z2:** `analytics.tech_source_tasks.source_note` (migration 011) giữ ghi chú của mọi dòng, gồm dòng IBS HI.
   - Đọc được bởi: `libetech_runtime` (011), `libetech_projector` (015), trang `/portfolio` (`src/server/team-catalog.ts`).
   - Dòng nhập của 027 đã bị chặn không giữ ghi chú IBS HI (`work_import_rows_guard`).

## 2. Cơ chế

### 2.1 Máy chủ: thêm trường `reason` (không đổi mã, không đổi status)

- `AppError` có thêm `reason` tuỳ chọn. `failure()` đưa `reason` vào `error` khi có. Đây là thay đổi chỉ thêm trường (E-INT-03): plugin 0.3.3 bỏ qua nó.
- `bridge.ts`:

| Chỗ | status | `reason` |
|---|---|---|
| nguồn hội thoại không khớp | 403 | `CHAT_SOURCE_INVALID` |
| tin riêng, người hỏi chưa thuộc dự án nào | 403 | `NO_PROJECT_YET` |
| nhóm không gắn dự án nào | 403 | `CHAT_NOT_MAPPED` |
| nhóm gắn dự án mà người hỏi không thuộc | 403 | `NOT_PROJECT_MEMBER` |
| không thấy hồ sơ đúng SHA | 404 | `RECORD_NOT_FOUND` |

- `reason` không mang tên dự án, mã dự án hay BU. Người hỏi đã qua ghép Telegram trước khi tới bước này.
- Không kiểm gì thêm. Phạm vi đọc không đổi.

### 2.2 Plugin 0.3.4: một bảng câu trả lời

- `REPLIES` trong `bot-plugin/__init__.py`. Tra theo thứ tự: (mã, reason) → (mã, status) → mã → câu dự phòng có kèm mã.
- Mỗi câu nói **nguyên nhân** và **việc làm tiếp**, và kết thúc bằng `(mã X)` để người vận hành tra được.
- Không câu nào nêu tên dự án, BU, nhóm hay người. Không câu nào viết «chờ Chairman quyết».
- `BackendError` giữ thêm `reason`. Chỉ nhận đúng một trong năm giá trị ở §2.1; giá trị khác bị bỏ, không tới câu trả lời hay mô hình (sửa sau cổng Codex).
- `/libetech-link`, `/libetech-check`, `/libetech-access-*` và `/duyet` trả câu trong bảng, không trả mã trơ.
- `libetech_os_read` trả `{ok:false, error, reason?, reply, instruction}`. `instruction` yêu cầu mô hình gửi nguyên văn `reply` và không tự giải thích mã. Mô tả công cụ bỏ cụm «chat/project scope».
- `safe_error` giữ nguyên hình dạng, vì đường intake và outbox dùng nó để ghi log.
- Mẫu tin của outbox, intake và pool không đổi. Plugin không gửi thêm tin nào.

### 2.3 Bảng nhóm → quyền

- Tệp `docs/BOT-GROUPS-20261126.md` gồm:
  - nhóm → dự án được phép → ai gửi được → ai đọc được → bot làm gì;
  - nhóm chung Team Tech ghi «không gắn dự án; dự án được chọn ở bước phân loại»;
  - bảng câu trả lời theo mã.
- Không có mã nhóm.

### 2.4 Che ghi chú IBS HI ở Z2 — migration 029

- **Chọn:** chuyển chữ ghi chú của dòng IBS HI sang bảng chỉ người vận hành đọc được, rồi để trống cột ở bảng Z2.
  - Chữ còn trong CSDL (đúng phương án (b) «che», không phải (c) xoá).
  - Vai ứng dụng và projector không đọc được. Trang và mã đọc không cần đổi quyền cột.
- Bảng `analytics.tech_source_notes_held`:
  - cột `tenant_id`, `project_id`, `source_id`, `source_row`, `source_note`, `held_at`;
  - UNIQUE theo (`tenant_id`, `source_id`, `source_row`, md5 của chữ): mỗi bản chữ khác nhau của một dòng được giữ một lần (sửa sau cổng Codex);
  - RLS ENABLE và FORCE, **không có policy**; REVOKE ALL với PUBLIC và mọi vai `libetech_*`.
- **Thế nào là dòng IBS HI:** dự án có `bu` khớp `work_import_is_ibs_text`, hoặc xác nhận miền mới nhất là `IBS_HI`. Đúng luật của 027.
- Hàm `public.tech_source_hold_notes(tenant, project)`, `SECURITY DEFINER`, chủ là login migration, `row_security=off`: chuyển ghi chú của một dự án IBS HI.
  - Migration gọi cho mọi dự án IBS HI (điền bù).
  - Trigger `AFTER INSERT` trên `project_domain_mappings` gọi khi một dự án được xác nhận `IBS_HI`, kể cả xác nhận lại sau khi đã đổi miền.
  - Trigger `AFTER UPDATE OF bu` trên `projects` gọi khi người vận hành đổi nhãn BU thành nhãn IBS HI.
  - Hàm xong mà dự án còn dòng giữ chữ thì lệnh gọi bị từ chối (`LTZ01`).
- Trigger `BEFORE INSERT OR UPDATE` trên `analytics.tech_source_tasks`: dòng IBS HI mang ghi chú thì bị từ chối (`LTZ01`).
- Điền bù xong mà còn dòng IBS HI giữ chữ thì migration dừng (fail-closed). Chạy lại 029 khi một dòng đã có thêm một bản chữ khác thì giữ cả hai.
- Importer `scripts/import-team-tech-catalog.ts` ghi ghi chú rỗng cho dòng IBS HI. Không chép chữ vào bảng giữ.
- `collaborators`, tiêu đề, người phụ trách, trạng thái, hạn: giữ nguyên (câu 4 (1)).
- Trang `/portfolio`: nhóm IBS HI ghi một câu «Dòng IBS HI không hiện ghi chú nguồn; xem bảng nguồn.»
- **Zone:** `tech_source_tasks` và `tech_source_notes_held` thuộc Z2. Bảng giữ không phải bảng báo cáo và không vai ứng dụng nào đọc được.
- **Hoàn tác** `rollback/029`:
  - Từ chối khi:
    - có migration lớn hơn 029;
    - một ghi chú đang giữ không còn dòng nguồn, dòng đó đang giữ chữ khác, hoặc một dòng có hai bản chữ đang giữ (hoàn tác sẽ làm mất chữ).
  - Khi chạy được: trả chữ về, bỏ trigger, hàm và bảng. Chạy lần hai không lỗi.

## 3. Tệp chạm

| Tệp | Việc |
|---|---|
| `src/server/errors.ts`, `src/server/http.ts` | trường `reason` |
| `src/server/bridge.ts` | `reason` cho năm chỗ từ chối |
| `bot-plugin/__init__.py`, `bot-plugin/plugin.yaml` | bảng `REPLIES`, 0.3.4 |
| `migrations/029_mask_ibs_hi_source_notes.sql` + `rollback/029_…` | che Z2 |
| `src/server/ibs-label.ts` (mới), `src/server/sheet-import.ts` | luật nhãn IBS HI dùng chung |
| `scripts/import-team-tech-catalog.ts` | không ghi ghi chú IBS HI |
| `src/app/portfolio/page.tsx` | câu cho nhóm IBS HI |
| `vitest.config.ts` | thêm `ibs-label.ts` vào coverage |
| `package.json`, `package-lock.json` | 0.9.3 |
| `docs/BOT-GROUPS-20261126.md`, `docs/EVIDENCE-REQUEST-20261125.md`, `docs/OPEN-QUESTIONS.md` | tài liệu |

## 4. Task và ca kiểm (viết ca trước, thấy đỏ bằng lỗi khẳng định rồi mới viết mã)

**T1 — `reason` ở cầu nối** (`tests/bridge-replies.test.ts`)
- nhóm không có trong `chatScopes`, và nhóm có mảng rỗng → `SCOPE_DENIED` 403 `CHAT_NOT_MAPPED`;
- nhóm gắn dự án người hỏi không thuộc → `NOT_PROJECT_MEMBER`;
- thành viên Team Tech chưa có dự án, hỏi ở tin riêng → `NO_PROJECT_YET`;
- SHA không có → 404 `RECORD_NOT_FOUND`;
- `failure()` đưa `reason` vào JSON; lỗi không có `reason` thì JSON không có khoá đó;
- **IBS HI:**
  - người chỉ thuộc dự án IBS HI hỏi ở nhóm gắn dự án Liberico → `NOT_PROJECT_MEMBER`;
  - JSON trả về không chứa tên dự án nào, không chứa mã hồ sơ Liberico, không chứa dữ liệu hồ sơ.

**T2 — bảng câu trả lời** (`tests/test_bot_replies.py`)
- mỗi mã trong danh sách đường lệnh có một câu riêng; hai mã khác nhau không dùng chung câu;
- `SCOPE_DENIED` có năm câu khác nhau theo `reason`; `SCOPE_DENIED` 404 không có `reason` (máy chủ cũ) ra câu «không thấy hồ sơ»;
- `/libetech-check` với máy chủ giả trả `TELEGRAM_NOT_LINKED` → câu có «/libetech_link» và «(mã TELEGRAM_NOT_LINKED)»;
- công cụ đọc trả `reply` và `instruction`; mô tả công cụ không còn «chat/project scope»;
- mã lạ → câu dự phòng có kèm mã; chuỗi không phải mã (có bí mật) → `BRIDGE_UNAVAILABLE`, câu không chép chuỗi đó;
- không câu nào chứa: `LBRC`, `Xeca`, `IBS`, `Liberico`, `BTNET`, `LibeAI`, `Dragon`, `Chairman`.

**T3 — bảng phủ đủ mã của máy chủ** (`tests/bridge-reply-coverage.test.ts`)
- Đọc `bridge.ts`, `bridge-auth.ts`, `account-approval.ts` và đoạn ghép, `telegramPrincipal`, `principal` của `identity.ts`.
- Mỗi mã ném ra ở đó có trong `REPLIES` của plugin, trừ danh sách miễn ghi rõ trong test: mã chỉ ném ở đường web.

**T4 — migration 029** (`tests/tech-source-mask.test.ts`, gồm cả các ca hoàn tác)
- sau 029, dòng IBS HI cũ có ghi chú rỗng và bảng giữ có đúng chữ; dòng LBRC giữ nguyên;
- `libetech_runtime` và `libetech_projector` đọc bảng giữ → bị từ chối, kể cả khi dự án IBS HI trong phạm vi;
- `teamCatalog` của người có dự án IBS HI không trả chữ ghi chú đó;
- ghi một dòng IBS HI mang ghi chú → từ chối; dòng LBRC mang ghi chú → được;
- xác nhận một dự án thành `IBS_HI` → ghi chú của dự án đó được chuyển sang bảng giữ;
- áp 029 hai lần không nhân bản; điền bù không xong thì migration dừng;
- hoàn tác trả chữ về; từ chối khi sẽ mất chữ; chạy lần hai không lỗi; từ chối khi có migration lớn hơn 029.

**T5 — importer và trang danh mục** (`tests/ibs-label.test.ts`): luật dùng chung (`src/server/ibs-label.ts`) trả ghi chú rỗng cho nhãn IBS HI và giữ ghi chú LBRC, XECA; khớp bản SQL ở nhãn rỗng và nhãn lạ; trang chỉ ghi câu giải thích ở nhóm IBS HI. Importer gọi đúng luật đó; trigger của T4 chặn nếu importer ghi chữ IBS.

## 5. Runbook (phần thêm)

- Migration 029 áp bằng login migration superuser. Sau khi áp, đếm bằng truy vấn chỉ đọc, chỉ in số:
  - số dòng của bảng giữ;
  - số dòng IBS HI ở `tech_source_tasks` còn ghi chú: phải là 0.
- **Plugin đổi (0.3.3 → 0.3.4)** nên phải khởi động lại gateway chung.
  - Chỉ ngoài giờ, có lời Chairman.
  - Sau đó kiểm 20/20 bot.
  - Web mới chạy được với plugin cũ, và plugin cũ bỏ qua `reason`.
- Thứ tự: web trước, plugin sau.

## 6. Cách hiểu tạm (ghi ở `docs/OPEN-QUESTIONS.md`)

- **Q-GV5D-1.** Tin gọi bot mà bị từ chối **lúc tiếp nhận** (chưa ghép, không trong roster, nhóm chưa ghi sổ) vẫn không có câu trả lời của bot trong nhóm.
  - Muốn trả lời cần một đường gửi mới không gắn tin đã lưu, và bot sẽ nói trong nhóm về người chưa được ghi sổ.
  - Người đó biết nguyên nhân khi hỏi bot hoặc gõ `/libetech_check`: bảng trả đúng câu.
  - Phương án: (1) giữ; (2) thêm câu từ chối trong nhóm. Tạm: (1).
- **Q-GV5D-2.** Che bằng cách chuyển chữ sang bảng chỉ người vận hành đọc. Phương án khác: quyền theo cột kèm hàm đọc. Tạm: chuyển bảng.

## 7. Nghiệm thu (thay bước chung của kịch bản 4)

Mỗi người ghi: tin hay lệnh đã gửi, nhóm (tên hiển thị), câu bot trả nguyên văn, mã trong ngoặc.

1. `BoM-1` lặp lại ca (a) và `BoM-2` lặp lại ca (b). Câu bot trả phải khớp một dòng của bảng, đúng nguyên nhân thật do người vận hành đối chiếu (ghép Telegram, membership, cấu hình nhóm). Ca chỉ được đối chiếu khi người báo xác nhận trên tin gốc.
2. Một tài khoản chưa ghép Telegram gõ `/libetech_check` → câu «chưa ghép» kèm cách ghép.
3. `Tech-1` hỏi ở nhóm chung → câu «nhóm không gắn dự án».
4. `Tech-1` hỏi một hồ sơ không có → câu «không thấy hồ sơ».
5. Người chỉ thuộc dự án IBS HI hỏi ở nhóm gắn dự án Liberico → câu «không thuộc dự án của nhóm», không có tên dự án nào.

## 8. Ngoài phạm vi D

E (tệp, tài liệu) và B6 (gỡ liên kết) ở PR 5; F (lịch nhắc) ở PR 6. Không đổi quyền đọc, không đổi ranh giới BU, không sửa `AGENTS.md`.
