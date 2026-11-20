# Trước khi áp migration 023 — N1, N2, N3

Version 0.1 · 20/11/2026 · N1–N3 của `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md` (mục «Điều kiện»). Biên nhận: `docs/DELIVERY-018-pre-023-n1-n3-20261120.md`. Chairman 19/11/2026 (nguyên văn, `docs/OPEN-QUESTIONS.md`): «023: áp cùng 022 trong một đợt riêng sau N1–N4; làm N4 (bộ cài phục hồi) trước; N2 kiểm trên gateway thật cùng Quân. N15 trước khi bật Z4.» **N4 chưa đóng**: PR #28 đã merge nhưng `docs/DELIVERY-017-n4-restore-after-023-20261120.md` ghi «điều kiện N4 chưa đóng» (hai bộ cài chưa chạy được đầu-cuối từ cây này).

**Trạng thái, nói đúng từng mức** (không mức nào là «đã chạy trên máy chủ thật»; 022 và 023 chưa áp lên dữ liệu thật; d1-ai1 và gateway thật không bị chạm):

| | Mã / quy trình | Đã thử trên PostgreSQL 16.15 thật (CSDL thử, dữ liệu tổng hợp) | Đã làm trên dữ liệu hay gateway thật |
|---|---|---|---|
| **N1** | `src/server/db.ts`: mọi phiên của mọi pool tự kết thúc giao dịch bỏ nhàn sau 30 giây; dịch vụ đọc lại bằng `SHOW`-tương-đương trước khi phục vụ | có (`tests/session-timeouts.test.ts`) | chưa; có hiệu lực khi triển khai mã mới |
| **N2** | mục 2 dưới đây: quy trình kiểm cùng người vận hành gateway | không thử được ở đây: cần gateway thật | **chưa chạy** |
| **N3** | `deploy/pre-023-check.sql`: đếm và dự báo các lần từ chối của 023; mục 3: cách đo trên bản sao | có (`tests/pre-023-check.test.ts`, 15 ca) | **chưa chạy**; thời gian 023 trên khối lượng thật **chưa đo** |

## 1 · N1 — giao dịch bỏ nhàn tự kết thúc

**Vì sao.** Từ 023, một giao dịch nhận tin bị để mở giữ dòng đếm của luồng nó, và mọi tin khác của luồng ấy chờ nó (`55P03` sau 5 giây, mỗi tin một lần). Giao dịch phải tự kết thúc nếu không ai đóng.

**Mã làm gì.**
- `pooledDatabase` gửi `idle_in_transaction_session_timeout = 30000` (hằng `IDLE_IN_TRANSACTION_TIMEOUT_MS`) làm tham số phiên lúc mỗi kết nối. Cả ba pool của dịch vụ (web `DATABASE_URL`, đăng nhập `IDENTITY_DATABASE_URL`, tiếp nhận `INTAKE_DATABASE_URL`) dựng qua hàm này, nên cả ba có. Một mặc định `0` đặt ở mức role không gỡ được nó: tham số phiên thắng.
- Pool của một login chạy thật (`requireRestricted`) đọc lại giá trị hiệu lực từ `pg_settings` ở lần truy vấn đầu và **từ chối phục vụ** nếu nó là `0` hoặc lớn hơn 30 000 ms (`assertSessionTimeouts`; câu từ chối cố định, không mang tên CSDL). Đó là «kiểm bằng `SHOW`» của điều kiện: nó chạy ở mọi lần khởi động, không phải một lần lúc triển khai. Nếu một bộ gom kết nối (PgBouncer) đứng trước CSDL và không cho tham số khởi động này thì kết nối hỏng hoặc phép đọc lại thấy `0`, và dịch vụ không lên, đó là điều ta muốn (#inference: chưa thử với một bộ gom thật).
- **Phát hiện khi làm (đo, không đoán):** khi server cắt một phiên đang mở giao dịch, `pg` phát sự kiện `error` trên chính kết nối; không có bộ nghe thì **tiến trình Node dừng** (đã chạy thử: lỗi `25P03 terminating connection due to idle-in-transaction timeout` thành ngoại lệ không bắt). Đặt timeout mà không xử lý chỗ này biến một giao dịch bị bỏ quên thành một lần sập dịch vụ. Nên `transaction()` gắn bộ nghe lỗi cho kết nối trong lúc mượn, trả cho người gọi **lỗi của câu lệnh của họ** (không để một `ROLLBACK` trên kết nối đã chết thay lỗi ấy), và bỏ kết nối chết thay vì trả lại pool.
- Một kết nối **rảnh** trong pool mà server kết thúc (khởi động lại, failover, `pg_terminate_backend`) trước đây cũng là ngoại lệ không bắt; nay mỗi pool có `pool.on('error')`. Cả hai chỗ chỉ ghi một sự kiện cố định kèm SQLSTATE (`db_session_ended`, `pool_idle_client_error`), không ghi lời lỗi hay thông tin kết nối: `25P03` trong log là timeout này.
- Giao dịch **đang làm việc** không bị cắt: bộ đếm tính thời gian bỏ nhàn, không tính tổng thời gian (có ca thử). Tôi đã rà danh sách nơi mở giao dịch trong `src/server` và `src/app` cùng kết quả `grep` `fetch`/`setTimeout`/`readFile`/Argon2: `fetch` và `setTimeout` chỉ có ở mã chạy trong trình duyệt (`src/components`), `readFile` chỉ ở `bridge-config.ts`, ngoài giao dịch, và phần chậm duy nhất trong một giao dịch là băm Argon2 ở `identity.ts` (chưa đo). Không thấy lệnh đợi ngoài CSDL trong một callback giao dịch; đó là đọc, không phải phép chứng minh (#inference).

**Việc còn lại cho N1 (từ review; chưa làm, không chặn 023).** (a) `check()` giữ lời từ chối đầu tiên mãi (có từ trước; phép đọc lại thêm một truy vấn có thể làm hỏng nó nếu lỗi tạm thời lúc khởi động: dịch vụ chạy lại là hết). (b) ~~`COMMIT` trong một giao dịch đã bị huỷ trả lệnh `ROLLBACK` mà không lỗi, nên một lần ghi có thể «thành công» mà không ghi gì~~ — **đã đóng 20/11/2026** ở `docs/DELIVERY-019-commit-aborted-transaction-20261120.md`: `transaction()` kiểm lệnh của `COMMIT` và ném một lỗi cố định (chưa triển khai). (c) Pool không đặt `query_timeout`/`keepAlive`: một `ROLLBACK`/`COMMIT` trên socket nửa chết có thể treo (có từ trước). (d) Lời từ chối của phép đọc lại là một `Error` thường: `failure()` ghi `errorType: Error` và người vận hành thấy một `500` trơn.

**Không đóng được bằng cơ chế:** một phiên tự đặt lại `SET idle_in_transaction_session_timeout = 0` (L4 của DELIVERY-016, cùng loại với R34 của PR #22). Phiên psql của người vận hành không đi qua pool: ai mở giao dịch trong phiên tay và bỏ đó vẫn giữ khoá luồng; đặt `idle_in_transaction_session_timeout` ở role vận hành là việc tuỳ chọn, ngoài mã này.

**Kiểm sau triển khai:** dịch vụ trả lời yêu cầu có đăng nhập đầu tiên (nếu phép đọc lại sai, mọi yêu cầu trả `500`). Không có lệnh SQL bên ngoài nào xem được tham số của phiên khác; đó là lý do phép đọc lại nằm trong dịch vụ.

## 2 · N2 — gateway thật gửi lại khi một luồng bị chặn (kiểm cùng người vận hành gateway)

**Điều cần chứng minh.** Mã đọc được cho thấy: gateway gọi `/api/bridge/intake/events` với `HOOK_TIMEOUT = 2` giây; trigger của 023 chờ khoá dòng đếm tối đa 5 giây; nên khi một luồng bị chặn, gateway **bỏ chờ trước** (không có câu trả lời ⇒ hạng `network`: giữ nguyên thứ tự, thử lại, **không đếm** vào `SPOOL_MAX_ATTEMPTS = 5`), tin vào `intake-spool.jsonl`, và không tin nào vào `intake-dead.jsonl`. Dòng 64 của chính `bot-plugin/__init__.py` ghi «Not verified against the running gateway», và repo không có bằng chứng nào rằng móc `pre_gateway_dispatch` đã được gateway thật gọi hay đã thấy nó thử lại. Đó là điều kiểm này đóng.

**Điều kiện trước (người vận hành gateway, Chairman chỉ định Quân, xác nhận từng dòng; tôi không biết máy chủ có sẵn gì):**
1. Một **nhóm thử** (không phải nhóm thật; gửi tin vào nhóm thật chưa được phép) và một profile gateway thử, `intake.json` có `hookEnabled: true` và `chats` chỉ gồm nhóm thử. **Cấu hình cầu nối phía server cũng phải liệt kê nhóm thử** trong `chatScopes` và `intake.chats` (`src/server/bridge-config.ts:15-19`; `src/server/intake.ts:47` từ chối một nhóm không có ở đó bằng `DENIED`): nếu không, bước 1 bị từ chối và tin vào `intake-dead.jsonl`, không phải vì 023.
2. Một bản AI OS **có 023** trên một CSDL **tổng hợp hay một bản sao đã phục hồi** (không phải CSDL phục vụ), đứng ở địa chỉ mà gateway thử gọi (`ORIGIN` trong `bot-plugin/__init__.py`). **Địa chỉ và profile của gateway là cố định trong mã**: `ORIGIN = http://127.0.0.1:3148` và `EXPECTED_HOME = /home/iptech/.hermes/profiles/libetech` (`bot-plugin/__init__.py:28-29`), và `deploy/install-d1.sh:14` coi cổng 3148 là cổng đích của dịch vụ thật. Nên bản AI OS thử phải đứng đúng ở `127.0.0.1:3148` của máy có gateway: một máy chưa có dịch vụ thật, hoặc dịch vụ thật đang dừng. Chọn cách nào là quyết định của Chairman.
3. Người vận hành gateway có quyền đọc `intake-spool.jsonl`, `intake-dead.jsonl` và nhật ký gateway; người chạy SQL có quyền superuser trên CSDL thử.

**Các bước (mỗi bước ghi kết quả vào bảng ở cuối; không dán nội dung tin hay id vào repo):**
1. **Một tin bình thường.** Gửi một tin vào nhóm thử. Ghi: móc có được gọi không; tin có vào CSDL (`SELECT count(*) FROM source_events` tăng 1); `intake-spool.jsonl` rỗng. Chưa đạt bước này thì dừng: không có gì để thử tiếp.
2. **Giữ khoá luồng.** Trong một phiên psql (superuser), giữ dòng đếm của luồng của tin ở bước 1 (cùng lệnh với `docs/RUNBOOK-RESTORE-AFTER-023.md` mục 6, quy tắc 1), và **đặt thêm `SET LOCAL idle_in_transaction_session_timeout = '30s'`** để phiên giữ khoá hành xử như một giao dịch của dịch vụ sau N1:
   ```sql
   BEGIN;
   SET LOCAL idle_in_transaction_session_timeout = '30s';
   SELECT last_seq FROM public.intake_thread_heads WHERE tenant_id = '<tenant_id>' AND project_id = '<project_id>' AND chat_id = '<chat_id>' AND thread_key = '<thread_key>' FOR UPDATE;
   -- để phiên mở, không gõ gì
   ```
3. **Gửi ba tin** vào đúng luồng ấy (trả lời tin bước 1), cách nhau vài giây, **khi khoá đang giữ**. Ghi với từng tin: gateway xử lý tin ấy mất bao lâu (kỳ vọng thêm 2 giây (`HOOK_TIMEOUT`) cho mỗi tin, không hơn nhiều); dòng log cố định `INTAKE_SPOOLED`; số dòng của `intake-spool.jsonl` (kỳ vọng tăng 1, 2, 3) và trường `attempts` của chúng (**kỳ vọng 0**); `intake-dead.jsonl` không có dòng mới.
4. **Một tin vào luồng khác** (nhóm thử, một tin không trả lời tin nào), vẫn khi khoá đang giữ. Kỳ vọng: nó **vào hàng đợi sau** ba tin trên (hàng đợi là một cho cả profile, theo thứ tự), không vào CSDL cho tới khi hàng đợi chảy. Đây là điều mã cho thấy mà chưa ai quan sát: một luồng bị chặn làm chậm mọi nhóm của cùng gateway cho tới khi nó chảy. Ghi nó như nó xảy ra; nó **không** làm mất tin.
5. **Thả khoá** (`COMMIT` hay `ROLLBACK`), hoặc để chính 30 giây bỏ nhàn thả nó và ghi lại: phiên có bị cắt không, sau bao lâu. Gửi một tin nữa. Kỳ vọng: gateway gửi lại theo thứ tự cũ, hàng đợi về 0, **mọi tin vào CSDL đúng một lần**, `intake-dead.jsonl` vẫn không có dòng mới.
6. **Đếm ở CSDL:** số bản (`source_event_revisions`) bằng số tin đã gửi; số của luồng (`source_revision_positions.thread_seq`) liên tiếp. Nếu một tin đã **vào CSDL ở lần gọi bị bỏ chờ** (khoá thả trong 5 giây, request phía server vẫn chạy xong) rồi bị gửi lại, lần gửi lại phải trả «đã có» chứ không tạo bản thứ hai: ghi là có xảy ra hay không.
7. **Tuỳ chọn, đo giới hạn:** giữ khoá lâu hơn 5 giây rồi thả (ca `55P03` phía server): server phải trả `500` cho request nào còn chờ, và không tin nào bị mất.

**Đạt khi:** bước 1 đạt; ở bước 3–5 **không tin nào mất**, không dòng nào vào `intake-dead.jsonl`, `attempts` của các dòng chờ là 0 (nếu có dòng ≥ 1: móc nhận được câu trả lời 5xx trong 2 giây, tức là một đường mà mã đọc không dự báo: ghi lại và dừng, đừng áp 023); và thời gian gateway chờ mỗi tin khi bị chặn là mức mà người vận hành gateway nói gateway chịu được. **Không đạt** ở bất kỳ điểm nào ⇒ N2 mở; báo Chairman trước khi lên kế hoạch đợt áp.

**Kết quả (điền khi chạy; để trống tới lúc ấy):**

| Bước | Quan sát | Đạt / không | Ai, ngày |
|---|---|---|---|
| 1 | | | |
| 2–3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |

## 3 · N3 — đếm bản trước khi áp; đo trên bản sao

**3.1 Đếm (đọc, không ghi).** Bằng login sẽ áp 023, trong cùng cài đặt sẽ áp nó, **qua kết nối trực tiếp** (không qua bộ gom kết nối ở chế độ giao dịch: ba câu lệnh của tệp có thể rơi vào ba phiên; `PRE-023-97` bắt điều đó, và câu cuối chỉ trả lời cho phiên đã làm việc), và lại một lần ngay trước khi áp:

```bash
psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -d <csdl> -f deploy/pre-023-check.sql
```

Thành công khi dòng cuối là `{"pre_023" : "ready", ...}`. `"blocked"` kèm danh sách mã: `PRE-023-01` (login không phải superuser; không đọc gì khác), `-02` (số bản chưa có số vượt trần, mặc định 250 000: `libetech.thread_order_max_rows`), `-03` (nháp ứng viên chưa có quyết định khi còn bản chưa số), `-04` (login thành viên `libetech_ai` đang kết nối), `-98` (thiếu thứ 023 cần: bảng, hàm `reject_history_mutation()` hay role `libetech_ai`/`libetech_runtime`: các migration trước chưa áp), `-99` (lỗi khác, kèm SQLSTATE; trần không phải số là `22P02`), `-97` (các câu lệnh không chạy trong một phiên). Cảnh báo `PRE-023-W1` không chặn: một phiên khác đang **giữ khoá xung đột với `SHARE ROW EXCLUSIVE`** (một người ghi đang chạy: một lần nhận tin) trên một trong các bảng mà 023 khoá (`source_event_revisions`, rồi `ai_drafts`, lần áp thứ hai thêm `draft_decisions`, lần áp đầu thêm `projects`). 023 khoá lần lượt; mỗi lần chờ tối đa 5 giây rồi `55P03` và không đổi gì. Chờ ở khoá đầu thì 023 chưa giữ gì; chờ ở khoá sau thì 023 đã giữ các khoá trước, và mọi lần nhận tin xếp hàng sau khoảng chờ ấy. Một phiên chỉ «bỏ nhàn trong giao dịch» mà không giữ khoá như vậy **không** được tính: nó không làm 023 chờ.

Câu trả lời cũng cho `statement_timeout`, `lock_timeout` và `idle_in_transaction_session_timeout` của **phiên chạy nó** (mili-giây, 0 là không có): 023 không đặt `statement_timeout`, nên mặc định của role/CSDL của phiên áp nó (cùng cài đặt, mục trên) áp cho từng câu lệnh của 023; câu đánh số (6,65–10,16 giây ở 500 000 bản theo review) là câu đứng đầu danh sách rủi ro. Bộ cài áp bằng `psql` với superuser, không qua pool, nên 10 giây của pool **không** áp, trừ khi một mặc định đặt nó. Nếu kế hoạch cần, đặt `PGOPTIONS="-c statement_timeout=0"` cho lần áp. Câu trả lời chỉ chứa số, đúng/sai và mã cố định. Script chỉ đọc (không ghi dữ liệu, không đổi đối tượng nào; khoá `ACCESS SHARE` của các phép đọc thường, dưới `lock_timeout` 3 giây của chính nó; hai cài đặt phiên cho câu trả lời). Mỗi mã `-02`, `-03`, `-04` khớp một lời từ chối có thật của 023 (ca thử của từng mã cũng áp 023 và thấy nó từ chối đúng lý do ấy; mỗi ca `ready` áp 023 và thấy nó chạy). `ready` không phải lời hứa, vì 023 kiểm lại dưới khoá của chính nó.

**3.2 Đo thời gian trên bản sao dữ liệu thật** (đếm chỉ nói **bao nhiêu** bản; không nói 023 giữ khoá **bao lâu**). Trần 250 000 chưa phải cam kết thời gian: review CSDL đo (header của 023) 6,65 giây ở 500 000 bản trong 70 000 luồng và 10,16 giây ở 500 000 luồng mỗi luồng một bản (dạng xấu nhất; đúng ở `statement_timeout` 10 giây của pool), cả hai dưới tải.
1. Lập một bản lưu **trước 023** đúng như `RUNBOOK-RESTORE-AFTER-023.md` mục 2 và diễn tập nó vào một CSDL **mới** theo mục 5 của tài liệu ấy (chỉ các migration mà nguồn đã có; bước 3, 4, 5, 7). Đó cũng là «bản sao lưu đã thử phục hồi» mà kế hoạch triển khai cần.
2. Trên bản sao, chạy 3.1 (ghi số bản và ba timeout), rồi áp các migration còn thiếu **trừ 023** (022 nếu chưa), rồi áp 023 và **đo cả tệp**:
   ```bash
   time psql -X -q -v ON_ERROR_STOP=1 -d <bản sao> -f migrations/023_thread_order.sql
   ```
   `time` cho thời gian của cả lần áp (kể cả kết nối); `\timing on` của `psql` in **từng câu lệnh**, không in tổng của giao dịch: dùng nó để biết câu nào chậm, không để lấy một con số. Ghi: số bản chưa số, thời gian (giây), có hay không `55P03`/`57014`/từ chối. **Một bản sao đứng yên cho một cận dưới**: con số của review được đo dưới tải. Muốn đo lại lần áp đầu: phục hồi lại, hoặc chạy `migrations/rollback/023_thread_order.sql` **trên bản sao** rồi áp lại. Lần áp thứ hai không đổi số nào (đã thử: ca A7; thời gian của nó chưa đo).
3. **Quy ra cho người dùng.** Ba giới hạn khác nhau, đừng lẫn:
   - **(a) Khi 023 bắt đầu:** nó chờ khoá đầu tối đa 5 giây (`lock_timeout` của chính nó). Nếu một lần nhận tin đang chạy lúc ấy, yêu cầu khoá của 023 xếp hàng và **mọi lần nhận tin sau đó xếp sau nó** (đó là cái `PRE-023-W1` báo trước); quá 5 giây 023 dừng với `55P03`, không đổi gì.
   - **(b) Khi 023 đang giữ khoá** (từ khoá đầu tới commit: `SHARE ROW EXCLUSIVE` trên `source_event_revisions`): một `INSERT` của lần nhận tin phải chờ khoá bảng. Ứng dụng **không đặt `lock_timeout`** (đã `grep` `src/`), nên chỉ có `statement_timeout` 10 giây của pool cắt nó, bằng `57014`, không phải `55P03` (đã đo trên PostgreSQL 16.15: chỉ `statement_timeout` ⇒ `57014`, chỉ `lock_timeout` ⇒ `55P03`). Gateway bỏ chờ sau 2 giây; yêu cầu phía server (#inference: suy từ cách Node xử lý yêu cầu, chưa quan sát) vẫn chờ tới khi khoá thả hoặc đủ 10 giây, **và giữ một kết nối của pool (tối đa 10)** suốt thời gian ấy: một loạt tin dồn vào trong lúc 023 chạy lâu có thể chiếm hết pool của login tiếp nhận. Đọc không bị chặn; đọc `draft_decisions` chờ từ bước 10 tới commit (khoá `ACCESS EXCLUSIVE`, ngắn).
   - **(c) Khoá dòng đếm** của luồng, trong trigger của lần nhận tin: chờ tối đa 5 giây, rồi `55P03`. Đây là giới hạn của một luồng bị một giao dịch bỏ quên giữ (N1, N2), không phải của việc áp 023.
   Từ đó: thời gian 023 **dưới 2 giây** — gateway không thấy gì; **2–10 giây** — mỗi tin trong khoảng ấy bị gateway bỏ chờ ở 2 giây, vào hàng đợi và gửi lại (yêu cầu phía server chạy xong khi khoá thả; gửi lại là «đã có», theo khoá chat + tin; N2 bước 6 kiểm điều này); **trên 10 giây** — các yêu cầu còn chờ phía server kết thúc bằng `500` (`57014`), không tin nào mất, và pool bị giữ. Ngưỡng nào chấp nhận là quyết định của Chairman cho kế hoạch đợt; tôi không đặt nó.
4. **Áp migration trước, mã sau** (đúng chữ của N3). Mã mới của PR #24 ghi cột `subject_thread_seq` của 023, nên chạy nó trên CSDL chưa có 023 là sai thứ tự. Mã cũ chạy cạnh 023 trong khoảng giữa hai bước: tin mới được trigger của 023 đánh số, và không có nháp ứng viên nào để xác nhận vì Z4 tắt (chưa thử đường này bằng mã cũ thật; #inference). **Khoảng hở của N1:** giới hạn 30 giây nằm trong mã mới; mã cũ giữa hai bước không có nó trong khi trigger của 023 đã giữ dòng đếm. Che khoảng hở bằng một mặc định ở role, **trước 023**, cho ba login của dịch vụ (kết nối phải mở lại: khởi động lại dịch vụ):
   ```sql
   ALTER ROLE libetech_web SET idle_in_transaction_session_timeout = '30s';
   ALTER ROLE libetech_auth SET idle_in_transaction_session_timeout = '30s';
   ALTER ROLE libetech_intake_svc SET idle_in_transaction_session_timeout = '30s';
   ```
   Đây là DDL ngoài migration (E-DB-04): một ngoại lệ có chủ ý, **chỉ thực hiện nếu kế hoạch đợt được Chairman duyệt**; nếu Chairman chấp nhận khoảng hở ngắn thì bỏ qua. Mã mới đặt cùng giá trị ở mức phiên nên hai lớp nhất quán.

**Chưa làm và không làm ở đây:** không áp 022/023 lên CSDL nào ngoài CSDL thử; không chạy 3.1 hay 3.2 trên dữ liệu thật (cần Chairman cho phép và một máy chủ); không viết kế hoạch triển khai của đợt (tài liệu riêng, chờ Chairman).

## 4 · Điều kiện của đợt 022 + 023 còn lại sau tài liệu này

N1 (mã xong, hiệu lực khi triển khai mã mới), N2 (chưa chạy), N3 (script xong; số đo chưa có), N4 (có mã, đã thử trên CSDL thử; **điều kiện chưa đóng** theo DELIVERY-017: bộ cài cần đóng gói và diễn tập trọn bộ), **N5** (xem DELIVERY-016), và kế hoạch của đợt: bản sao lưu đã thử phục hồi, cách rollback, danh sách bot bị ảnh hưởng, tránh 08:30 ngày làm việc và 16:00 thứ Sáu. N6 và N15 là điều kiện **trước khi bật Z4**, không phải trước khi áp 023.
