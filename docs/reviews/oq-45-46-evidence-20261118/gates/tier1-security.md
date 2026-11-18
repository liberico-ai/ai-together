# Review bảo mật tầng 1 — cả nhánh `feat/oq-45-46-ai-drafts` (PR mã của OQ-45 và OQ-46)

- Ngày: 18/11/2026. Người soát: agent `liberico-security-reviewer` (mô hình Fable 5.2), phiên mới, chưa xem nhánh này trước đó.
- Phạm vi: `git diff 4f12a3c f36e947` (23 tệp, gồm `docs/`), cùng 32 tệp log chưa theo dõi trong `docs/reviews/oq-45-46-evidence-20261118/*.txt`.
- Cách làm: chỉ đọc. Không chạy test, không kết nối CSDL, không ghi git, không đọc `.env*` hay `.runtime/`, không in dòng lệnh tiến trình. Tệp duy nhất được ghi là báo cáo này.
- Đây là khuyến nghị cho Chairman, không phải phê duyệt. Người sửa là Builder / Planner; người duyệt là Chairman.
- Nhãn: `#fact` = đọc được trong mã, tệp hoặc log; `#inference` = suy luận từ mã hoặc từ hiểu biết về PostgreSQL, chưa đo ở lượt này.
- Không finding nào chạm hệ thống vận hành của IBS HI. Các mục có chữ `IBS_HI` nói về luật dữ liệu «chỉ con trỏ» trong AI OS (`AGENTS.md:16`).

## Kết luận ngắn

Không có P0. Không có P1. Ba P2 (đều là thiếu trong hồ sơ quyết định / danh sách «trước khi bật Z4», không đòi sửa `src` hay `migrations`). Mười một P3. Trong 23 finding bảo mật cũ: 20 ADDRESSED, 2 mới khép một phần (SEC-M6; 4ab-N6 ý (c)), 1 là phán quyết giữ nguyên (T3-M4) và nên giữ. Guard `LTZ02` đóng đúng đường vòng đã đo và tôi không tìm ra đường mới qua nó.

## Bước 0 — quét bí mật trên cả nhánh

| Hạng mục | Kết quả | Nhãn |
|---|---|---|
| Khoá, token, JWT, khoá riêng, token bot Telegram trong 3 804 dòng thêm của diff | 0 trùng mẫu | `#fact` |
| Chuỗi kết nối (`postgres://…` và tương tự), `PGPASSWORD`, địa chỉ IP, `localhost`, cổng | 0 | `#fact` |
| Đường dẫn thư mục máy, tên tài khoản hệ điều hành, đường dẫn iCloud / Drive trong dòng thêm | 0 | `#fact` |
| Tên CSDL thử | Chỉ có tên hai **biến** môi trường ở `docs/plans/oq-45-46-ai-drafts.md:270`, không có giá trị | `#fact` |
| Mã nhóm Telegram thật | 0 trong diff. Fixture có sẵn (`tests/slice2-fixtures.ts:13-16`, không đổi ở nhánh này) dùng mã dạng `-100…` chỉ gồm 2–3 chữ số khác nhau: dữ liệu tổng hợp | `#fact` |
| Tên người thật | 0 (dò họ tiếng Việt + tên riêng; tên trong fixture là «Người mẫu») | `#fact` |
| Tệp `.env*`, tệp tên khớp `secret / credential / key / token / .pem` được theo dõi tại `f36e947` | Không có | `#fact` |
| Tệp từng được thêm rồi gỡ trong 12 commit của nhánh (bí mật nằm lại trong lịch sử) | Không có; không commit nào xoá tệp | `#fact` |
| `.gitignore` thử trên tên thật (`git check-ignore`) | `.env`, `.env.local`, `.env.production`, `.env.bak`, `.env.json.bak`, `.runtime/`, `.superpowers/`, `data/` đều bị bỏ qua | `#fact` |
| 32 log `*.txt` (chưa theo dõi) | 0 đường dẫn máy (tiêu đề vitest là `<repo>`), 0 chuỗi kết nối, 0 token, 0 email, 0 IP, 0 tên CSDL. Một lần trùng chữ «secret» là tên một ca kiểm có sẵn. Có: phiên bản máy chủ thử (`measurements-pg16.txt`), số tiến trình trong cảnh báo của Node, 115 uuid của dữ liệu tổng hợp, chuỗi đánh dấu tổng hợp | `#fact` |

Kết quả bước 0: **sạch đối với phần nhánh này thêm vào**. Ba ghi chú, không tính là finding của nhánh:

1. `#fact` `.gitignore` không phủ bản sao iCloud dạng `<tên> 2.<đuôi>` (thử: một tên như vậy dưới `migrations/` **không** bị bỏ qua). Lúc soát đếm 0 tệp như vậy. Repo đang công khai: giữ luật «chỉ `git add` theo đường dẫn nêu đích danh» (P3-10).
2. `#fact` Ngoài diff, có sẵn ở base: ít nhất 30 tệp được theo dõi chứa đường dẫn thư mục nhà của một máy (lớp: tên tài khoản hệ điều hành và bố cục thư mục), ví dụ `AGENTS.md:3`, `docs/DEPLOY-002.md:8`, các tệp dưới `deploy/`. Nhánh này không thêm tệp nào vào danh sách đó. Việc của một lượt soát riêng cho cả repo, không phải của PR này.
3. Log bằng chứng chưa được commit. Kết quả quét chỉ đúng với nội dung lúc soát; quét lại khi `git add` chúng.

## 1. Guard mới `LTZ02` (từ chối mức cô lập khác READ COMMITTED)

Mã: `migrations/022_ai_drafts_pointer_only_guard.sql:21-23`. Ca: G16 (`tests/z4-pointer-guard.test.ts:246-273`), G17 (`:275-290`, chỉ native).

**Có đóng đúng đường vòng đã đo không: có.** `#fact` Phép kiểm đứng **trước** câu đọc bảng ánh xạ, nên ở mức cô lập khác không còn câu trả lời nào phụ thuộc dự án: bit «`IBS_HI` hay không» (R4) cũng mất ở các mức đó. `#fact` Log native của phiên chính (`fix1a-native-verbose.txt:212-213`) ghi G16 và G17 đạt; `fix1a-red.txt:28-29` ghi G16 đỏ vì `AssertionError` trước khi có mã.

**Có mở đường mới không: tôi không tìm ra.** Từng điểm được hỏi:

| Điểm | Phán đoán | Nhãn |
|---|---|---|
| Giả mạo `transaction_isolation` trong giao dịch | Không làm được. Thiết lập này gắn thẳng vào mức cô lập thật của giao dịch; PostgreSQL từ chối đổi nó sau câu lệnh đầu tiên đã lấy ảnh chụp («must be called before any query») và trong giao dịch con. Đổi **trước** câu lệnh đầu thì đó là đổi thật, không phải giả mạo. `set_config`, `SET LOCAL`, mệnh đề `SET` của một hàm tạm đều đi qua cùng phép kiểm | `#inference` |
| Nhập ảnh chụp cũ vào giao dịch READ COMMITTED | Không làm được: `SET TRANSACTION SNAPSHOT` chỉ nhận REPEATABLE READ hoặc SERIALIZABLE, tức các mức guard đã từ chối | `#inference` |
| `read uncommitted` | PostgreSQL chạy nó như READ COMMITTED, nhưng thiết lập trả chữ `read uncommitted` nên guard từ chối. Đóng thừa, không phải đường vòng | `#inference` |
| Giao dịch con / savepoint | Mức cô lập là của giao dịch ngoài cùng; savepoint không đổi được | `#inference` |
| Ở READ COMMITTED, câu đọc trong guard có dùng ảnh chụp cũ được không (con trỏ đang mở, CTE ghi, `INSERT … SELECT` chạy lâu, khối `DO`, hàm tạm) | Không. Hàm trigger là VOLATILE nên mỗi câu SQL trong nó lấy ảnh chụp mới ở READ COMMITTED, bất kể câu lệnh ngoài bắt đầu lúc nào. Hàm STABLE không chạy được lệnh chèn | `#inference` |
| Hàm definer đọc thiết lập của người gọi | Chỉ đọc `transaction_isolation` (không giả được, trên). Không đọc biến `app.*` nào. `search_path = pg_catalog, pg_temp` và `row_security = off` ghim trên hàm (`:15`); tên bảng và hàm viết đủ schema; các chuỗi hằng không có dấu `\` nên `standard_conforming_strings` của người gọi không đổi nghĩa. `session_replication_role` (tắt trigger) cần superuser | `#fact` cho mã, `#inference` cho hành vi |
| Role runtime | Không có quyền `INSERT` trên `intelligence.ai_drafts` (`migrations/021_ai_suggestions_z4.sql:161-165`): `permission denied` trước khi trigger chạy, không nhận `LTZ02` hay `LTZ01` (G13, `:207`) | `#fact` |
| Login vận hành | Bị buộc như mọi role (G16, khối thứ ba). Vẫn tắt được trigger vì là superuser (khoảng trống 40, không đổi) | `#fact` |
| `pg_restore` | Chạy ở mức mặc định của login phục hồi. Nếu mức mặc định của login hoặc của CSDL không phải READ COMMITTED thì **mọi** dòng nháp bị từ chối `LTZ02` lúc phục hồi (đóng). R21 chỉ nói về login của pipeline (P3-11) | `#inference` |
| Harness test | `BEGIN` mặc định; G16 chạy cả PGlite lẫn native. Không ca nào chèn nháp ở mức khác ngoài G16, G17 | `#fact` |

**`LTZ02` đi thô qua `submitDraft` có lộ gì không.** `#fact` `src` không nhắc `LTZ02` ở đâu; `submitDraft` chỉ dịch `LTZ01` (`src/server/suggestions.ts:172-175`). `#inference` Với trình điều khiển `pg`, đối tượng lỗi mang: câu cố định «An AI draft is written in a READ COMMITTED transaction», mã, và ngữ cảnh PL/pgSQL (tên hàm, số dòng) — đều là thứ đã công khai trong repo; không mã dự án, không bit nào về ánh xạ, không nội dung nháp. `#fact` Riêng với PGlite (`node_modules/@electric-sql/pglite` bản 0.5.15), mọi lỗi CSDL được gắn thêm `query`, `params`, `queryOptions`: lỗi thô từ `submitDraft` khi đó mang nguyên các tham số của lệnh chèn, tức cả nội dung nháp. Người nhận hôm nay là chính bên gọi (pipeline) và PGlite chỉ dùng cho bản trình diễn; nhưng bất kỳ nơi nào về sau ghi log đối tượng lỗi đó sẽ ghi nội dung nháp (P3-6).

**Chỗ còn mỏng ở ca kiểm (P3-2).** `#fact` Nửa READ COMMITTED của G17 (`:288`) chạy sau khi nửa đầu đã commit dòng `IBS_HI` cho cùng dự án, nên dự án đã là `IBS_HI` từ trước khi giao dịch thứ hai mở. Nó chứng minh `LTZ01` ở READ COMMITTED, chưa chứng minh câu của tệp migration («only that level reads the latest mapping») cho một ánh xạ commit **sau** câu lệnh đầu của giao dịch. Bằng chứng cho điều đó hiện chỉ là phép đo 1 trong `measurements-pg16.txt` (chạy trước đợt sửa).

## 2. Từng finding cũ

`A` = ADDRESSED; `A-dư` = không đổi mã, đã ghi thành phần dư theo phán quyết của phiên chính, và tôi đồng ý; `P` = mới khép một phần.

| Id | Phán | Căn cứ tại `f36e947` | Ghi chú |
|---|---|---|---|
| SEC-M1 / DB-M-6 | A | `migrations/022_ai_drafts_pointer_only_guard.sql:21-23`; G16 `tests/z4-pointer-guard.test.ts:246`; G17 `:275` | Mục 1 ở trên |
| SEC-M2 | A-dư | R22, `docs/plans/oq-45-46-ai-drafts.md:793` | Đúng cỡ |
| SEC-M3 | A | `tests/migrations-rollback.test.ts:466` (không còn `.catch` trên lệnh áp lại) | |
| SEC-M4 | A | G18 `tests/z4-pointer-guard.test.ts:292-305` | Ca chạy bằng login vận hành (`:296`), không dưới role AI như finding gốc đề nghị. Việc trigger chạy cho `MERGE` không phụ thuộc role (P3-3) |
| SEC-M5 | A | `tests/suggestions.test.ts:1053-1055` | Danh sách cấm 9 khoá và `cause`, không phải danh sách cho phép; chưa có `query`, `params` (P3-6) |
| SEC-M6 | **P** | G12 `tests/z4-pointer-guard.test.ts:196-198` | Chỉ khẳng định thân hàm **chứa** bảy đoạn. Kịch bản gốc («một migration sau thay thân rộng hơn mà G12 vẫn xanh») còn nguyên: thêm SQL động hay thông điệp có mã mà giữ bảy đoạn thì vẫn xanh (P3-1) |
| T3-M1 | A | L3 `tests/suggestions.test.ts:778-782`; L4 `:803-808` | Có danh sách khoá và đối chứng dương |
| T3-M2 | A | L6 `tests/suggestions.test.ts:822-840` | Phép so viết ra, không suy từ dịch vụ |
| T3-M3 | A-dư | R24, kế hoạch `:795` | Chữ của B1 (`:129`) không sửa; R24 bổ sung |
| T3-M4 | giữ phán quyết | R25, kế hoạch `:796`; điều kiện 11, `:808` | Mục 3 ở dưới |
| T3-M5 | A | `src/server/suggestions.ts:97-98` | |
| 4ab-I1 | A | Q5 (i), (ii) `tests/source-text.test.ts:173-192`; `fix1b-mutations.txt` | Log đột biến chỉ có cho (i); (ii) chưa có đột biến «thêm trần» |
| 4ab-N1 | A | `src/server/source-text.ts:93`; chú thích `:82-83` | |
| 4ab-N2 | A | M10 `tests/suggestions.test.ts:1013-1031` | |
| 4ab-N3 | A | `tests/source-text.test.ts:169-170` | |
| 4ab-N4 | A-dư | R29, kế hoạch `:800` | Câu P3 ở `:83` vẫn ghi «với cùng mã»; đọc cùng R29 |
| 4ab-N5 | A-dư | R29, kế hoạch `:800` | Chưa được chép vào mục OQ-54 (`docs/OPEN-QUESTIONS.md:884-893`), nơi Chairman sẽ đọc khi quyết (P3-4) |
| 4ab-N6 | **P** | (a), (b): R29, kế hoạch `:800` | Ý (c) chưa làm: chú thích ở `src/server/suggestions.ts:210` và `:297` không nói nháp tài liệu không có phép kiểm tương đương (P3-4) |
| T6-I1 | A | T9, T10 `tests/source-text.test.ts:268-283`; hai đột biến trong `fix1b-mutations.txt` | |
| T6-M1 a–d | A | T11–T14 `tests/source-text.test.ts:285-325`; đột biến cho T11, T12, T14 | |
| T6-M2 | A | `src/server/source-text.ts:103-105` | |
| T6-M3 | A-dư | R26, kế hoạch `:797`; `docs/OPEN-QUESTIONS.md:876`; điều kiện 12, `:809` | |
| T6-M4 | A-dư | R27, kế hoạch `:798`; `docs/OPEN-QUESTIONS.md:876` | Xem P2-3 |

Tổng: 23 mục — 20 ADDRESSED (14 bằng mã hoặc ca kiểm, 6 bằng phần dư), 2 khép một phần (SEC-M6, 4ab-N6 (c)), 1 phán quyết giữ nguyên (T3-M4).

## 3. Phán quyết T3-M4 của phiên chính — nên giữ

`#fact` Người không có quyền quyết định gọi `decide` cho một nháp ứng viên: qua phép định vị (`src/server/suggestions.ts:250-251`), lấy khoá tư vấn (`:255`), dòng nháp kể cả `value` được đọc vào tiến trình Node (`:256`), chèn dòng khoá lệnh (`:266`), rồi bị từ chối `MANAGER_REQUIRED` ở phép kiểm đầu tiên của thân khoá lệnh (`:268-271`); cả giao dịch lùi. Câu trả lời không phụ thuộc `valueHash` gửi lên hay trạng thái của nháp (L8, `tests/suggestions.test.ts:853`).

Lý do phiên chính nêu là đúng, và tôi kiểm được: `#fact` ca «replay after a change of role…» (`tests/suggestions.test.ts:604-613`) ghim rằng một điều phối đã bị hạ vai gửi lại đúng lệnh cũ vẫn nhận quyết định đã ghi (không kèm nội dung). `#inference` Đưa phép xét quyền lên trước khoá lệnh, như review Task 3 đề nghị, sẽ đổi câu trả lời đó thành `MANAGER_REQUIRED`: câu «câu trả lời cho người gọi không đổi» của finding gốc không đúng cho trường hợp phát lại. Thứ còn lại là: `value` nằm trong bộ nhớ tiến trình trong một giao dịch ngắn (không gì ghi log, không gì ra câu trả lời), và một vai đọc gọi lặp có thể làm lệnh của điều phối xếp hàng sau khoá. R25 và điều kiện 11 tả đúng cỡ.

Một hướng gia cố **không** đụng hợp đồng khử trùng, để xét cùng thiết kế tuyến (P3-8): câu đọc ở `:256` không lấy `value`; chỉ nhánh xác nhận, sau khi đã qua quyền, mới đọc `value`; và câu đọc cuối ở `:315` dùng `DRAFT_META_SQL` khi người gọi không có quyền quyết định.

## 4. Cả nhánh — bốn quyết định của Chairman

### (a) Người không có quyền xác nhận có nhận nội dung nháp hay thứ bên ghi chọn không

`#fact` `list`: người không có quyền đi câu `DRAFT_META_SQL` (`src/server/suggestions.ts:91-92`, chọn ở `:228-230`); `value`, `value_hash`, `skill_version`, `model_version` là `NULL` ngay trong SQL; cột `sources`, `questions`, `confidence` không có trong câu lệnh nào (`:87`). `present` trả về ngay ở `:197`, trước mọi phép kiểm lược đồ, mọi lần dựng ngữ cảnh và mọi câu đọc luồng (M5, M10). `toView` tự ép «không nội dung khi có mã che» (`:95-107`).

`#fact` `decide`: không có quyền thì cùng một câu từ chối với mọi `valueHash`, mọi trạng thái (`:268-271`). Phát lại sau khi mất quyền: câu trả lời đi qua `present` nên bị che `CONFIRM_AUTHORITY_REQUIRED` (`:317`; ca ở `tests/suggestions.test.ts:604`). `viewer`, `bot`, người ngoài dự án, ngoài tenant: 404 như cũ (`:224`, `:251`).

`#fact` `submitDraft`: không trả `DraftView`. Lỗi: chỉ mã lý do; câu `DRAFT_HELD` ghép từ một tập mã đóng (`:301`).

Thứ bên ghi còn chọn được mà tới người không có quyền: kỹ năng, một bit `manifestHash`, số dòng, thứ tự, và thời điểm chèn (`createdAt`) — đúng như R15 và R24 kê. Không tìm ra đường nào khác. Kết luận (a): **không còn đường**, trong phạm vi đọc được từ mã.

### (b) Người có quyền nhưng không đọc được chữ của tin có nhận chữ đó qua nháp không

`#fact` Trong mã, chữ của tin hiện hay ẩn theo cấu hình (cờ nhóm, ánh xạ dự án, chế độ lưu), không theo từng người; mọi vai đọc của dự án đọc được hộp tin (`src/server/inbox.ts:30-37`). «Không đọc được chữ» vì vậy là: cờ nhóm đã gỡ, dự án thành `IBS_HI`, tin lưu ở chế độ chỉ con trỏ, hoặc tin nằm ngoài cửa sổ 20 tin.

`#fact` Các lớp che cho người có quyền (`:198-214`): giá trị lệch hợp đồng; không dựng được ngữ cảnh; dự án chỉ con trỏ; mã nháp nêu nằm ngoài ngữ cảnh hoặc là tin không hiện chữ; và, với nháp ứng viên, luồng có chữ đã lưu mà nay không hiện (`src/server/source-text.ts:85-94`, phép `IS NOT TRUE`, mã sai dạng trả `true`, thiếu dòng trả `true`).

Đường còn lại, đều đã được ghi:

1. **Nháp tài liệu mang chữ của tin mà không nêu mã tin** — R16, OQ-55 (`docs/OPEN-QUESTIONS.md:904`), và được ghi rõ là «không phải hướng chặt nhất». Đây là đường thật của một pipeline trung thực (ngữ cảnh hỗn hợp của `ba_elicitation`, `pm_planning`).
2. **Nháp ứng viên chép chữ của một luồng khác** — R29; chỉ bên ghi không trung thực mới có chữ đó.
3. **`valueHash` dưới lớp che** — R3.
4. **Danh sách nhóm hiện chữ là bản chụp lúc dựng dịch vụ** — **chưa** có trong phần dư hay danh sách «trước khi bật Z4» (P2-2).

Kết luận (b): trong mã không còn đường nào ngoài bốn mục trên; mục 4 phải được ghi.

### (c) Một nháp của dự án `IBS_HI` có được lưu không

`#fact` Guard chạy cho mọi role ghi, trước `WITH CHECK`, trước phép dò trùng khoá (G5, G6, G7, G14, G18). Khoá ngoại `(project_id, tenant_id)` của bảng nháp (`migrations/021_ai_suggestions_z4.sql:57`) chặn việc ghi một dự án `IBS_HI` dưới tenant khác để tránh câu đọc của guard: điều kiện `m.tenant_id = NEW.tenant_id` (`022…sql:25`) vì vậy không hở. `domain_code` là tập đóng có CHECK (`migrations/013_project_registry.sql:30`), nên không có biến thể chữ hoa–thường nào lọt phép so `= 'IBS_HI'`.

Đường còn lại, đều đã được ghi: ánh xạ commit giữa câu đọc của guard và lúc commit của lệnh chèn (R5, R21 — nội dung dòng khi đó được viết trước ánh xạ, cùng lớp với OQ-54); nháp lưu trước khi dự án thành `IBS_HI` (R2, OQ-54); guard vắng hoặc bị tắt (R19); phục hồi data-only (R20); superuser.

Một điểm **chưa** được ghi: dự án **chưa ánh xạ** (P2-1).

### (d) Một nháp có đối tượng đã đổi có được xác nhận không

`#fact` Tài liệu: lệnh xác nhận khoá dòng tài liệu (`src/server/suggestions.ts:260`); đường duy nhất thêm bản (`src/server/documents.ts:156`, `:169`) lấy cùng khoá; câu so (`:109-111`) chạy sau khoá. Hai ca thứ tự native (`tests/suggestions-concurrency.test.ts:102`, `:121`; log `fix1b-native.txt`) cho kết quả chắc chắn, không phải chạy đua. Luồng tin: `threadFreshness` (`src/server/source-text.ts:107-122`) — không trần, đồng hồ ghi, bản sửa của mọi tin, `>=`; mọi câu trả lời lạ (thiếu dòng, mã sai dạng, ứng viên không thấy) thành «không có mốc» và bị giữ (`:109`, `:121`; `suggestions.ts:122`).

`#fact` Phép kiểm chỉ bị bỏ qua khi không dựng được ngữ cảnh, và khi đó đã có `ENTITY_NOT_FOUND` (`:293-300`). Từ chối vẫn làm được; phát lại không phải một lần xác nhận mới.

Đường còn lại: **khe theo thứ tự commit của đường nhận tin** (R6, R27) — một tin hay bản sửa mà giao dịch nhận bắt đầu trước mốc nhưng commit sau khi pipeline đã đọc ngữ cảnh thì không bao giờ bị phát hiện. Đã ghi và đúng cỡ, nhưng không có chỗ nào để Chairman quyết về nó (P2-3).

### Bất biến «điều bị che lúc đọc luôn bị giữ lúc xác nhận»

`#fact` Giữ được. Mọi mã che của `present` (`:200`, `:204`, `:206`, `:208`, `:213`) có phép giữ tương ứng trong `decide` (`:293-298`; `checkSkillOutput` ở `:296` trả cả ba mã hiển thị). Khi không dựng được ngữ cảnh, mã có thể khác (R29) nhưng nháp vẫn bị giữ. Chiều ngược lại (giữ mà không che) là có chủ ý.

### Ba giữ chỗ (OQ-53 hai điểm, OQ-55)

- **Có thật là fail-closed không: có.** `#fact` `SUBJECT_BASELINE_MISSING`: `suggestions.ts:122`, `:129`. `SUBJECT_EDIT_UNVERIFIED`: `:124`. `THREAD_TEXT_HIDDEN`: `:210-214` (che), `:298` (giữ). Một trường hợp không giữ — tài liệu chưa có bản nào (`:127`) — được ghi ở kế hoạch `:63` và trong chữ của phương án 2 (a) của OQ-53.
- **Có được trình trung thực là «không phải phương án được chọn» không: có, ở cả ba nơi.** `#fact` Mã: chú thích `:121`, `:123`, `:128`, `:210`, `:297` và tên ca «dừng tại OQ-53», «dừng tại OQ-55». Kế hoạch: bảng `:60-65`, ràng buộc `:251`. Mục OQ: `docs/OPEN-QUESTIONS.md:882`, `:908`. Hai chỗ nên sửa chữ: chú thích trong mã chưa nói nháp tài liệu không được phủ (P3-4); dòng «Hành vi hiện tại» của OQ-53, OQ-55 và ba dòng «chưa có mã» của OQ-45, OQ-46 (`:671`, `:687`, `:861`) sẽ sai ngay khi PR merge (P3-9).

### Điểm lời Chairman chưa phủ mà mã đã chọn hướng nới, chưa ghi thành câu hỏi mở

Tìm được một: dự án chưa ánh xạ (P2-1). Các điểm khác theo hướng không chặt nhất đều đã được ghi: C8 (vai đọc vẫn thấy dòng nháp), nháp tài liệu ở OQ-55, `modelVersion` (R17), `valueHash` dưới lớp che (R3).

## 5. Tenant / dự án và Quality Gate 34a–e

| Câu SQL hoặc đối tượng mới | Ranh giới | Phán |
|---|---|---|
| `DRAFT_META_SQL`, `DRAFT_SQL` trong `list` (`suggestions.ts:229-231`) | `project_id=$1` cùng RLS của role runtime, phạm vi thu về một dự án (`:227`) | Đạt. `#fact` |
| `DOC_SUBJECT_SQL` (`:109-111`) | `project_id=$1`, `document_id=$2`; tenant qua RLS | Đạt. `#fact` |
| `threadHasHiddenText` (`source-text.ts:88-92`) | bốn điều kiện `project_id=$1`; tenant qua RLS | Đạt, với một ghi chú 34d ở dưới |
| `threadFreshness` (`:112-120`) | ba điều kiện `project_id=$1`; tenant qua RLS (T8); điều kiện dự án của chính câu lệnh được ghim khi RLS không thu hẹp (T12) | Đạt. `#fact` |
| Hàm và trigger của 022 | Chạy ngoài RLS, tự lọc theo tenant và dự án của chính dòng (`022…sql:25`) | Đạt, với phần dư R4 |

- **34a (đọc):** role AI không được cấp gì, không gọi được hàm, không đọc được bảng ánh xạ (G8). Đạt.
- **34b (ghi):** dòng nêu tenant khác bị RLS từ chối (G4); khoá ngoại chặn cặp tenant–dự án lệch. Đạt.
- **34c (sửa, xoá):** G10. Đạt.
- **34d (không ngữ cảnh):** không gì được lưu (G7). Hai điều cần biết. (1) Bit `IBS_HI` của guard có cả khi không có ngữ cảnh và xuyên tenant — đã ghi (R4), ca G7 và G9 nói thẳng. (2) `#fact` `threadHasHiddenText` trả `false` («không có chữ đang ẩn») khi ứng viên không thấy được, kể cả khi không có ngữ cảnh; ca Q5 ghim chính giá trị `false` đó (`tests/source-text.test.ts:164-165`). Hôm nay không tới được vì nơi gọi đã che bằng `ENTITY_NOT_FOUND`; tự thân hàm là mặc định mở (P3-7).
- **34e (không đường vòng):** role AI không `BYPASSRLS`, không thành viên (G8). Hàm definer là một đường đọc ngoài RLS có chủ ý, trả đúng một bit. Đạt, với R4.
- **Migration (M-01…M-03):** số tuần tự, chạy lại không đổi gì (G12), có tệp lùi và tệp lùi chạy lại được (RB1, RB2). Đạt.

`#fact` Ngoài phạm vi thay đổi, đã có từ base: ba câu đọc của `decide` lọc theo `d.id` và dựa vào phạm vi RLS đã thu hẹp (`suggestions.ts:250`, `:256`, `:315`), không khớp chữ «mọi câu đọc của dịch vụ có `project_id=$n`» của kế hoạch `:260`. Không phải finding của nhánh.

## 6. Finding mới

| Mức | Vị trí | Lớp | Căn cứ | Sửa đề xuất | Vai |
|---|---|---|---|---|---|
| P2-1 | `migrations/022_ai_drafts_pointer_only_guard.sql:24-29`; `src/server/source-text.ts:20-21`; kế hoạch `:67-77`, `:191` | Điểm lời Chairman chưa phủ, mã theo hướng nới, chưa ghi | `#fact` + `#inference` | Ghi thành cách hiểu chờ xác nhận và thành điều kiện «trước khi bật Z4» | Planner; Chairman xác nhận |
| P2-2 | `src/server/suggestions.ts:135` (dùng ở `:181`, `:212`, `:298`); kế hoạch `:227`, `:756` | Danh sách điều kiện thiếu: bản chụp cấu hình | `#fact` + `#inference` | Mở rộng điều kiện 4 | Planner |
| P2-3 | `docs/OPEN-QUESTIONS.md:876-879`; kế hoạch `:224`, `:753`, `:798`; `src/server/source-text.ts:112-120` | Phần dư không có chỗ để quyết | `#fact` + `#inference` | Thêm một điểm vào OQ-53 hoặc một điều kiện riêng | Planner; Chairman quyết |
| P3-1 | `tests/z4-pointer-guard.test.ts:196-198` | Ca kiểm: thân hàm definer mới ghim một phần (SEC-M6) | `#fact` | So cả thân hàm | Builder |
| P3-2 | `tests/z4-pointer-guard.test.ts:275-290` | Ca kiểm: nửa READ COMMITTED của G17 không chứng minh điều tệp migration nói | `#fact` | Dùng một dự án chưa ánh xạ cho nửa đó | Builder |
| P3-3 | `tests/z4-pointer-guard.test.ts:296` | Ca kiểm: G18 chạy bằng login vận hành | `#fact` | Thêm một lượt dưới role AI | Builder |
| P3-4 | `src/server/suggestions.ts:210`, `:297`; `docs/OPEN-QUESTIONS.md:884-893`; kế hoạch `:83` | Chữ: 4ab-N6 (c), 4ab-N5, câu P3 | `#fact` | Ba câu chữ | Builder (chú thích); Planner (hồ sơ) |
| P3-5 | Kế hoạch `:794`, `:806` | Phần dư R23 nhỏ hơn thật | `#inference` | Viết lại R23 | Planner |
| P3-6 | `src/server/suggestions.ts:172-175`; kế hoạch `:755` | Lỗi CSDL thô; PGlite gắn tham số vào lỗi | `#fact` | Bổ sung điều kiện 3; cân nhắc dịch `LTZ02` | Planner; Builder nếu được duyệt |
| P3-7 | `src/server/source-text.ts:82-83`, `:88-93`; `tests/source-text.test.ts:164-165` | Mặc định mở ở mức hàm (34d) | `#fact` | Trả `true` khi ứng viên không thấy được | Planner quyết; Builder |
| P3-8 | `src/server/suggestions.ts:256`, `:315` | Gia cố quanh T3-M4 | `#inference` | Không đọc `value` trước khi qua quyền | Planner, cùng thiết kế tuyến |
| P3-9 | `docs/OPEN-QUESTIONS.md:671`, `:687`, `:861`, `:882`, `:908` | Hồ sơ sẽ sai khi merge | `#fact` | Thêm khối trạng thái ở cuối tệp | Phiên chính |
| P3-10 | `.gitignore` | Bản sao iCloud không bị bỏ qua; repo công khai | `#fact` | Thêm mẫu, hoặc giữ luật `git add` theo đường dẫn | Phiên chính |
| P3-11 | Kế hoạch `:792`, `:805` | Điều kiện về mức cô lập chỉ kể login của pipeline | `#inference` | Thêm login phục hồi và login runtime vào điều kiện 8 | Planner |

### P2-1 — Dự án chưa ánh xạ: guard và lớp che coi là «không phải `IBS_HI`», chưa được ghi thành cách hiểu hay câu hỏi mở

- `#fact` Guard chỉ ném `LTZ01` khi dòng ánh xạ mới nhất là `IBS_HI`; không có dòng nào thì cho qua (`022…sql:24-29`; chú thích `:3`: «Unmapped and other labels decide nothing»). `isIbsHiSql` cùng luật (`src/server/source-text.ts:20-21`), nên lớp che `POINTER_ONLY_PROJECT` cũng không bật. Ca G2 và S3 ghim điều đó.
- `#fact` Lời Chairman nói «dự án `IBS_HI`»; không nói gì về dự án chưa có dòng ánh xạ. `AGENTS.md:16`: dòng ánh xạ do người có thẩm quyền tạo hoặc xác nhận, dự án chưa ánh xạ hiện «Chưa xác nhận». Danh sách C1–C9 của kế hoạch (`:67-77`) không có mục nào về điểm này; B4 (`:191`) chỉ nêu như một dữ kiện thiết kế.
- **Kịch bản.** Một dự án phục vụ công việc IBS HI vừa được tạo; dòng ánh xạ chưa được xác nhận. Pipeline (khi Z4 bật) ghi nháp có đủ nội dung; người có quyền đọc và xác nhận được. Vài ngày sau dòng `IBS_HI` được ghi: từ lúc đó nội dung bị che và bị giữ, nhưng các dòng nháp nằm lại vĩnh viễn (bảng bất biến) — đúng tình huống của OQ-54, và sinh ra từ một trạng thái thường gặp, không cần đối thủ.
- **Vì sao P2, không cao hơn.** Luật «chưa ánh xạ không quyết định gì» có từ trước PR và cùng hướng với quyết định OQ-28 (c) cho chữ của tin; Z4 chưa bật; PR đọc đúng chữ. Nhưng đây là cùng loại với C8 («đọc đúng chữ, không phải hướng chặt nhất»), và C8 thì được ghi.
- **Sửa (chỉ hồ sơ).** (1) Thêm một cách hiểu chờ Chairman xác nhận: «dự án chưa ánh xạ không bị từ chối lúc ghi và không bị che; không phải hướng chặt nhất». (2) Thêm vào OQ-54 một phương án: nháp của dự án chưa ánh xạ bị từ chối lúc ghi. (3) Thêm điều kiện «trước khi bật Z4»: mọi dự án pipeline được phép ghi đã có dòng ánh xạ được xác nhận, hoặc có lời Chairman cho hướng hiện tại.

### P2-2 — Danh sách nhóm hiện chữ là bản chụp lúc dựng dịch vụ; điều kiện «trước khi bật Z4» chưa nói tới việc nó cũ đi

- `#fact` `excerptChats` được nhận một lần ở hàm dựng (`src/server/suggestions.ts:135`) và dùng cho cả ba phép kiểm về chữ của tin (`:181`, `:212`, `:298`). R9 (`:227`) và điều kiện 4 (`:756`) chỉ nói dịch vụ phải «được dựng với đúng danh sách». Review Task 4a/4b đã nêu điều này ở mục cảnh báo 2 và ở «ba việc đòn bẩy cao nhất»; nó không vào R20–R29 hay danh sách đánh số.
- **Kịch bản.** Tuyến đọc nháp về sau dựng một instance dùng lâu. Người vận hành gỡ cờ hiện chữ của một nhóm. Instance vẫn giữ danh sách cũ: tin của nhóm đó vẫn là «hiện chữ» trong ngữ cảnh dựng lại, `threadHasHiddenText` trả `false`, nên nháp nêu các tin đó không bị che, và lệnh xác nhận cũng không giữ. Đây là đúng đường mà quyết định OQ-45 điểm 2 (b) sinh ra để chặn («sau khi cờ nhóm bị gỡ»).
- **Sửa (chỉ hồ sơ).** Viết lại điều kiện 4: dịch vụ nhận danh sách hiện hành theo **từng yêu cầu**, hoặc instance được dựng lại khi cấu hình đổi; kèm một ca kiểm «gỡ cờ rồi đọc lại» ở mức tuyến.

### P2-3 — Khe theo thứ tự commit của đường nhận tin (R6, R27) được tả đúng nhưng không có chỗ để quyết

- `#fact` Mốc của luồng tin là `created_at` (lúc bắt đầu giao dịch nhận tin). OQ-53 tả khe hở ở phần «Phía B» (`docs/OPEN-QUESTIONS.md:876`) và viết «cần được cân cùng phương án 1 (b)», nhưng các phương án của OQ-53 (`:878-879`) không có phương án nào nói về khe này. Điều kiện 1 (`:753`) chỉ đòi «OQ-53 có quyết định».
- **Kịch bản.** `#inference` Ba ảnh của một album đến cùng lúc; giao dịch nhận ảnh thứ hai bắt đầu trước giao dịch của ảnh thứ ba nhưng commit sau khi pipeline đã đọc ngữ cảnh (ngữ cảnh có ảnh một và ba). Nháp nêu ảnh một và ba; mốc là thời điểm ghi của ảnh ba, muộn hơn của ảnh hai. Ảnh hai (có chú thích đính chính) không bao giờ bị xem là «tin mới»: nháp được xác nhận trên một luồng mà nó chưa đọc hết. Chairman chọn 1 (a) và 2 (a) cho OQ-53 thì điều kiện 1 đã đạt, trong khi khe còn nguyên và chưa ai quyết chấp nhận hay đóng.
- **Sửa (chỉ hồ sơ).** Thêm điểm 3 vào OQ-53 với hai phương án: (a) chấp nhận khe, ghi vào biên nhận; (b) số thứ tự của luồng (một migration và đổi đường nhận tin). Hoặc một điều kiện riêng trong danh sách «trước khi bật Z4».

### Các P3

- **P3-1 (SEC-M6).** Kịch bản: migration 023 `CREATE OR REPLACE` hàm, giữ bảy đoạn cũ và thêm một câu `EXECUTE` hoặc một thông điệp có `NEW.project_id`; G12 vẫn xanh, trong khi hàm chạy bằng quyền superuser trên giá trị do role không tin chọn. Sửa: so `prosrc` (đã chuẩn hoá khoảng trắng) với phần giữa `$$ … $$` của tệp 022. Cũng thêm thân hàm vào câu catalog của điều kiện 7 (`:804`).
- **P3-2 (G17).** Sửa: cho nửa READ COMMITTED một dự án chưa có dòng `IBS_HI` nào lúc giao dịch mở (ví dụ dự án khác), để ca chứng minh «ánh xạ commit sau câu lệnh đầu vẫn được thấy».
- **P3-3 (G18).** Sửa: thêm một lượt `MERGE` trong `asAi(…)` — cũng xác nhận hành vi của `MERGE` dưới RLS trên PostgreSQL 16.
- **P3-4 (chữ).** (i) Chú thích ở `suggestions.ts:210`: thêm «document drafts have no equivalent check (R16, OQ-55)». (ii) Mục OQ-54: thêm một dòng «Điều kèm theo» rằng với dự án chỉ con trỏ `value` vẫn được đọc vào tiến trình dịch vụ rồi mới bị bỏ, và hướng đóng là trả `NULL` ngay trong SQL. (iii) Câu P3 của kế hoạch (`:83`) ghi «với cùng mã»: đánh dấu là đã được R29 sửa.
- **P3-5 (R23).** R23 viết «Mặc định của PostgreSQL là không ghi tham số». `#inference` Đúng cho tham số gắn; nhưng mặc định `log_min_error_statement = error` ghi **chữ của câu lệnh** bị lỗi, nên một lệnh chèn thô viết giá trị ngay trong chữ SQL (không qua `submitDraft`) để lại nội dung của nháp bị từ chối — tức nội dung về một dự án `IBS_HI` — trong log máy chủ ở cấu hình mặc định. Điều kiện 9 nói «bốn thiết lập» còn R23 chỉ kể ba. Sửa: kể đủ bốn (`log_min_error_statement`, `log_parameter_max_length_on_error`, `log_statement`, `log_min_duration_statement`), thêm `log_line_prefix` có role và địa chỉ (dấu vết duy nhất của việc dò bit ở R4).
- **P3-6 (lỗi thô).** Điều kiện 3 (`:755`) đã đòi tuyến bọc lỗi CSDL thô. Bổ sung hai dữ kiện vào biên nhận: `LTZ02` không được dịch và không có ca nào ở mức dịch vụ ghim câu trả lời của nó; với PGlite 0.5.15 đối tượng lỗi mang `query` và `params` (nội dung nháp). Hướng gọn hơn, cần phán quyết của planner: `submitDraft` bọc mọi lỗi không phải `AppError` thành một lỗi cố định, và S1 thêm `query`, `params`, `queryOptions` vào danh sách khoá phải vắng.
- **P3-7 (34d ở mức hàm).** Sửa: trong câu lệnh, `CASE WHEN NOT EXISTS(ứng viên trong dự án) THEN true ELSE EXISTS(…) END`; ca Q5 đổi kỳ vọng thành `true` cho dự án khác và tenant khác. Hoặc giữ mã, thêm một ca «không có ngữ cảnh» cho cả hai hàm đọc luồng để hành vi được ghim có chủ ý.
- **P3-8.** Xem mục 3.
- **P3-9.** Khi merge: thêm khối trạng thái ở cuối `docs/OPEN-QUESTIONS.md` («đã có mã» cho bốn quyết định; ba giữ chỗ nay nằm trong mã, không chỉ trong kế hoạch) và sửa mục «Câu hỏi mở chưa quyết» của `docs/DELIVERY-012-review-skills-20261115.md`. Biên nhận chỉ tới mức «đã có mã».
- **P3-10.** Thêm mẫu `* 2.*` (và biến thể không đuôi) vào `.gitignore`, hoặc ghi luật `git add` theo đường dẫn vào biên nhận.
- **P3-11.** R21 và điều kiện 8 chỉ nói login của pipeline. `#inference` Login phục hồi cũng phải ở READ COMMITTED (mục 1), và hai phép kiểm «đối tượng đã đổi» của `decide` dựa vào việc login runtime ở READ COMMITTED (câu so đọc sau khi chờ khoá). Thêm hai login đó vào điều kiện 8.

## 7. Phần dư và danh sách «trước khi bật Z4» — đủ và đúng cỡ chưa

`#fact` Đã đọc B6 (R1–R19, kế hoạch `:217-237`), R20–R29 (`:791-800`), sáu điều kiện gốc (`:751-758`) và bảy điều kiện bổ sung (`:802-810`).

- **Đúng cỡ:** R2, R3, R4, R5 cùng R21, R6 cùng R27, R15 cùng R24, R16, R19, R20, R22, R25, R26, R28, R29.
- **Nhỏ hơn thật:** R23 (P3-5); R9 và điều kiện 4 (P2-2).
- **Chưa có ở đâu, phải vào biên nhận:**
  1. Dự án chưa ánh xạ được ghi nháp và không bị che (P2-1).
  2. Danh sách nhóm hiện chữ phải là danh sách hiện hành ở mỗi lần đọc (P2-2).
  3. Khe theo thứ tự commit cần một quyết định riêng (P2-3).
  4. Login phục hồi và login runtime cũng phải ở READ COMMITTED (P3-11).
  5. Lỗi thô của PGlite mang tham số của lệnh chèn; `LTZ02` không được dịch (P3-6).
  6. G12 mới ghim bảy đoạn của thân hàm definer, chưa ghim cả thân; câu catalog sau khi áp 022 nên so cả thân (P3-1).
  7. Kết quả native và các đột biến là log của phiên chính; các reviewer theo task và lượt này đều không chạy lại.
  8. Ngoài nhánh: các đường dẫn thư mục máy có sẵn trong repo công khai (bước 0, ghi chú 2).

## 8. Mục cảnh báo — không kiểm được ở lượt này

1. **Không chạy test, không nối CSDL.** Mọi câu về hành vi lúc chạy dựa vào mã và vào log của phiên chính: `fix1a-native-verbose.txt` (218 đạt), `fix1b-native.txt` (255 đạt; năm ca đồng thời, ba lượt), `fix1b-mutations.txt` (bảy đột biến đỏ vì `AssertionError`, 0 «timed out»). Lượt cả bộ, typecheck, build và coverage tại `f36e947` đang chạy lúc soát: chưa thấy kết quả.
2. **Các câu về PostgreSQL ở mục 1** (không đổi được mức cô lập sau câu lệnh đầu; hàm VOLATILE lấy ảnh chụp mới ở READ COMMITTED; không nhập được ảnh chụp ở READ COMMITTED) là `#inference` từ tài liệu và mã nguồn PostgreSQL, chưa đo ở lượt này. Hai phép đo rẻ để khép: (i) trong một giao dịch REPEATABLE READ đã chạy một câu đọc, thử `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` — chờ lỗi `25001`; (ii) giao dịch READ COMMITTED của role AI chạy một câu đọc, kết nối khác commit dòng `IBS_HI` cho một dự án **chưa** có dòng nào, rồi chèn — chờ `LTZ01` (đây cũng là ca P3-2).
3. **`MERGE` dưới role AI** trên PostgreSQL 16 chưa có ca (P3-3).
4. **Đường dựng `Principal` từ phiên** (R7) nằm ngoài diff; chưa lượt nào soát. Hạ vai chỉ có hiệu lực khi phiên được dựng lại.
5. **Không nơi nào trong `src` dựng `SuggestionService`.** Cách tuyến sau này truyền `excerptChats` và handle của role AI chưa tồn tại để soát (P2-2; khoảng trống 7, 42).
6. **Cấu hình triển khai** không có trong repo: mức cô lập mặc định của các login, thiết lập log của cụm, trần giao dịch của login nhận tin (kích thước thật của khe R6).
7. **Kế hoạch thực thi** của hai câu đọc luồng trên luồng dài chưa đo (điều kiện 13).
8. **Lịch sử git ngoài nhánh** không quét. Tệp `.env.example` trong lịch sử (W6 của review Task 1–2) không được đọc. Trạng thái công khai của repo lấy từ tệp bối cảnh, không kiểm qua mạng.
9. **Log bằng chứng chưa được theo dõi:** quét lại lúc commit.

## 9. Ba việc có đòn bẩy cao nhất

1. **P2-1, P2-2, P2-3 — ba đoạn hồ sơ**, không đụng `src` hay `migrations`: một cách hiểu mới về dự án chưa ánh xạ, điều kiện 4 viết lại cho bản chụp `excerptChats`, và một điểm quyết cho khe theo thứ tự commit. Làm trước khi viết biên nhận, để danh sách «trước khi bật Z4» mà Chairman đọc là danh sách đủ.
2. **P3-1 cùng P3-2 — hai ca kiểm của guard:** ghim cả thân hàm definer, và cho G17 một nửa READ COMMITTED chứng minh đúng câu mà tệp migration viết. Rẻ, và là hai chỗ duy nhất mà lưới của một hàm chạy bằng quyền superuser còn mỏng.
3. **P3-5 cùng P3-6 — nội dung nháp trong log:** viết lại R23 cho đúng cỡ (chữ câu lệnh bị lỗi được ghi theo mặc định), và ghi rằng lỗi thô của PGlite mang tham số. Cả hai là đường để nội dung của một nháp bị từ chối, kể cả của dự án `IBS_HI`, nằm lại ngoài bảng.

VERDICT: READY FOR GATE
