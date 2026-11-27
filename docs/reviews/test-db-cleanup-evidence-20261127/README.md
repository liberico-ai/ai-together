# Bằng chứng: CSDL thử `slice1_verify_<ms><nn>` bị bỏ lại — 27/11/2026

Nhánh `fix/test-db-leftovers`, tách từ `36baa8e`, đã gộp `e64794c` (PR 55) ở `876b856`. Chỉ đổi bốn tệp trong `tests/` và thêm thư mục này: không đổi `src/`, `scripts/`, `migrations/`, plugin hay phiên bản.

Mọi cổng, đột biến và lỗi tiêm trong `logs/` chạy trên cây `819d6d6` (băm bốn tệp kiểm: `logs/files.txt`). Sau commit đó chỉ thêm log và tệp này. Đường dẫn máy trong log đã thay bằng `<repo>`, `<home>`, `<tmp>`; địa chỉ CSDL thành `<db-url>`. Hai tệp `logs/cause-*.txt` là bản chụp trạng thái máy chủ thử.

**Máy khởi động lại giữa phiên (11:53 +07)** và xoá thư mục tạm của phiên. Hai log nguyên nhân được chụp lại từ nhật ký máy chủ (nhật ký còn nguyên; các con số trùng bản đầu, riêng tổng dung lượng 11 CSDL từ 163 MB thành 162 MB). `codex-round-1.md` và `codex-context-round-1.md` được lấy lại nguyên văn từ bản ghi phiên của Codex trên máy. Log «đỏ» đầu tiên bị mất theo; xem mục «Đỏ trước, xanh sau».

## Nguyên nhân

`tests/restore-rehearsal.test.ts` (ở `36baa8e`) tạo khoảng hai chục CSDL tạm mỗi lượt. Trong `afterAll`, nó xoá chúng qua `pooledDatabase` rồi `.catch(()=>{})`. `pooledDatabase` đặt `statement_timeout` 10 s. `DROP DATABASE` phải chờ checkpoint. Chờ quá 10 s thì lệnh bị huỷ, lỗi bị nuốt, lượt chạy vẫn xanh, CSDL ở lại.

| Bằng chứng | Kết quả | Tệp |
|---|---|---|
| Nhật ký máy chủ thử, 20–27/11 | 12 lệnh `DROP DATABASE … WITH (FORCE)` trên CSDL tên kiểu này bị huỷ, cả 12 với `canceling statement due to statement timeout`. Checkpoint đầu tiên hoàn tất sau khi gửi lệnh: sau 10,1 đến 22,3 s | `logs/cause-server-log.txt` (`cause.py`) |
| `pg_database` | 11 CSDL tên kiểu kiểm còn lại đều `datconnlimit = -2`: không hợp lệ, do một `DROP DATABASE` bị ngắt giữa chừng. 15 CSDL `slice*` còn lại lúc chụp đều `-1`. Máy chủ từ chối kết nối vào CSDL `-2` | `logs/cause-databases.txt` |

11 trong 12 tên ở nhật ký trùng đúng 11 CSDL còn lại. Lệnh thứ 12 (27/11 03:43 UTC) trỏ tới CSDL không còn trong container. Checkpoint của nó dài tổng 184,7 s, sync 10,3 s: đúng con số mà biên nhận PR 55 ghi cho lượt native đầu hỏng ở `afterAll` của bản đầu `migrate-runner.test.ts`.

Gán 11 CSDL còn lại cho `restore-rehearsal.test.ts` là suy luận từ ba điều: lệnh trong nhật ký đúng câu của tệp đó; chúng có từ 22/11 đến 26/11, còn tệp khác duy nhất đặt tên kiểu này (`tests/migrate-runner.test.ts`) được commit lần đầu 27/11 10:08 +07; hai script có tạo CSDL dùng tên khác. Nhật ký không ghi tệp kiểm nào đã gửi lệnh.

Phần lớn tên kết thúc bằng `01` (một cặp `01`, `02`). Suy luận: vòng lặp xoá theo thứ tự tạo, và lệnh đầu thường là lệnh phải chờ checkpoint.

Không cần checkpoint rất dài: có lượt một checkpoint `immediate` 11,9 s là đủ.

## Sửa

- **`tests/test-databases.ts` (mới).** Mỗi câu `CREATE`/`DROP` chạy trên một client `pg` riêng, không giới hạn thời gian câu. `dropAll()` thử mọi CSDL mà `create()` đã tạo, rồi ném lỗi nêu tên và lý do từng CSDL chưa xoá được. `create()` hỏng thì lỗi nêu tên đã xin tạo.
- **`tests/restore-rehearsal.test.ts`.** Dùng tệp trên. Việc xoá nằm trong `finally`, nên vẫn chạy khi bước dọn trước đó ném lỗi. Hook dọn có hạn riêng 600 s; trước đó là `hookTimeout` chung 30 s.
- **`tests/migrate-runner.test.ts` (PR 55).** Bản đã gộp không còn giới hạn 10 s và không nuốt lỗi, nhưng vòng xoá dừng ở lệnh đầu bị từ chối. Tiêm một lần từ chối thì **cả 5 CSDL của lượt ở lại** và lỗi không nêu tên CSDL nào (`logs/faults.txt`, lượt cuối). Nay dùng cùng tệp dọn.

Hạn 600 s: tệp diễn tập có 21 chỗ gọi `freshDatabase`, mỗi chỗ thêm một lệnh xoá vào hook. Trong nhật ký 20–27/11, checkpoint `immediate` có p99 2,8 s, lớn nhất 11,9 s; lượt chờ dài nhất thấy được ở một lệnh bị huỷ là ít nhất 22,3 s. 600 s là trần cho máy chủ không trả lời, không phải con số đo được.

## Ca kiểm (`tests/test-databases.test.ts`, 4 ca, chỉ chạy trên PostgreSQL thật)

| Ca | Kiểm |
|---|---|
| lệnh xoá lâu hơn 10 s | giữ khoá của CSDL 12 s; CSDL vẫn bị xoá |
| kết nối của một lệnh xoá bị ngắt | `pg_terminate_backend` đúng backend của lệnh đó; CSDL kế tiếp vẫn bị xoá; lỗi chỉ nêu CSDL còn lại |
| máy chủ từ chối xoá | CSDL là template; lỗi nêu tên và lý do; CSDL kế tiếp vẫn bị xoá |
| `CREATE DATABASE` hỏng | lỗi nêu tên; `dropAll()` không đụng CSDL cùng tên mà nó không tạo |

Lưới dọn của bộ ca nằm ngoài mã được kiểm, và chỉ xoá khi tên còn trỏ đúng OID mà ca đã thấy.

## Đỏ trước, xanh sau

Lượt đỏ đầu tiên chạy trước khi sửa, trên cách dọn cũ tách thành tệp riêng, không đổi hành vi, với bản đầu của ca (2 ca): cả 2 đỏ bằng lỗi khẳng định. Log đó mất khi máy khởi động lại. Hai log dưới là chạy lại trên cây cuối.

| Log | Chạy gì | Kết quả |
|---|---|---|
| `logs/red.txt` | 4 ca cuối, thay `tests/test-databases.ts` bằng `old-behaviour.ts.txt` (cách dọn của `36baa8e`) | **4/4 đỏ**, 5 `AssertionError`, không ca nào hết giờ. Lệnh bị giữ bị huỷ sau 10 005 ms, `dropAll()` báo thành công, CSDL còn nguyên |
| `logs/red-create-failure.txt` | 4 ca cuối trên tệp dọn ở `e21dd10` (cây Codex đọc) | 1 đỏ (ca `CREATE` hỏng), 3 đạt |
| `logs/targeted-verbose.txt` | diễn tập khôi phục + ca dọn + ca runner, trên cây cuối | 28/28 đạt (19 + 4 + 5); không CSDL nào của lượt còn lại |

## Đột biến trên mã cuối (`logs/mutations.txt`, `mutate.py`)

Mỗi lượt đổi một chỗ trong `tests/test-databases.ts` rồi trả lại. Không lượt nào có ca hết giờ.

| Đột biến | Số ca đỏ |
|---|---|
| M1: đặt lại `statement_timeout` 10 s | 1/4 |
| M2: nuốt lỗi xoá | 2/4 |
| M3: dừng ở lỗi đầu tiên | 2/4 |
| M4: một client cho mọi lệnh xoá | 1/4 |
| M5: bỏ `client.on('error')` | **0/4 — không ca nào bắt** |
| M6: ghi tên trước khi `CREATE` xong | 1/4 (`dropAll()` xoá mất CSDL không do nó tạo) |

**M5.** Đường mà listener bảo vệ chỉ chạy khi socket đứt mà máy chủ không gửi gì. Dựng nó cần một cầu chuyển tiếp, còn `create()` chỉ nhận cổng 55471. Đo riêng (`pg-silent-drop.mjs`, `logs/pg-silent-drop.txt`): không có listener thì có `uncaughtException`; có listener thì chỉ câu đang chạy bị từ chối.

## Lỗi tiêm vào ca thật (`logs/faults.txt`, `fault.py`)

| Lỗi tiêm | Kết quả lượt chạy | CSDL còn lại |
|---|---|---|
| diễn tập: một CSDL không cho xoá | 19/19 đạt nhưng bộ đỏ, thoát 1, lỗi nêu tên CSDL | 1 (đúng CSDL đó) |
| diễn tập: bước dọn trước lệnh xoá ném lỗi | bộ đỏ, thoát 1 | 0 |
| runner, cây này: một CSDL không cho xoá | 5/5 đạt nhưng bộ đỏ, thoát 1, lỗi nêu tên | 1 (đúng CSDL đó) |
| runner **của `e64794c` (trước)**: một CSDL không cho xoá | bộ đỏ, thoát 1, lỗi không nêu tên | **5** |

CSDL còn lại sau mỗi lượt do script xoá. Script nhận ra chúng vì chủ sở hữu là login riêng của phiên.

## Cổng trên cây cuối (`819d6d6`)

| Cổng | Kết quả | Log |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | thoát 0 | `logs/typecheck.txt` |
| `npm run build` | thoát 0; không tệp được theo dõi nào bị đổi | `logs/build.txt` |
| `python3 -m pytest tests/` | 182 ca đạt, 210 subtest | `logs/pytest.txt` |
| PGlite với coverage | 98 tệp đạt, 17 bỏ qua; 1632 ca đạt, 171 bỏ qua; câu lệnh 96,23 %, nhánh 91,88 %, hàm 97,7 %, dòng 97,92 % | `logs/pglite-coverage.txt` |
| PostgreSQL 16.15 (container cục bộ), có `SLICE1_PG_CONTAINER` nên ca diễn tập có chạy | 115 tệp, 1803 ca đạt, không ca nào bỏ qua; không CSDL nào của lượt còn lại | `logs/native.txt` |

So với log của `e64794c`: thêm một tệp và 4 ca chỉ chạy native; bốn số coverage không đổi. Log native có 9 dòng cảnh báo `pg` «client.query() when the client is already executing», bằng đúng số dòng trong log native của PR 55; lượt chạy riêng ba tệp mà nhánh này sửa hay dùng tệp dọn không có dòng nào.

Trong lượt native, nhật ký máy chủ chỉ có hai `DROP DATABASE` kết thúc bằng lỗi, đều do hai ca cố ý gây ra; **không có lệnh nào bị huỷ vì quá giờ**. Cùng lượt có checkpoint dài 354,1 s và 182,7 s. Nhật ký không ghi câu chạy thành công, nên **không biết** có lệnh xoá nào của lượt này đã phải chờ chúng hay không.

## Cổng Codex, một vòng (`codex-round-1.md`)

Đầu vào: `docs/reviews/CODEX-REVIEW-PROMPT.md`, `codex-context-round-1.md` và diff `36baa8e..e21dd10` của `tests/`. Kết quả: **`VERDICT: CHANGES_REQUIRED`** (1 P0, 2 P1, 1 P2). Sửa ở `140e1d4`. Không chạy vòng hai. **Codex chưa đọc `140e1d4`, cũng chưa đọc `e35311b` (chuyển `migrate-runner.test.ts`, viết sau khi gộp PR 55). Cây cuối không có `PASS` nào của Codex.**

| Mức | Finding | Đã làm |
|---|---|---|
| P0 | Lưới dọn của bộ ca xoá lại theo tên sau khi `dropAll()` đã xoá, nên có thể xoá CSDL cùng tên của phiên khác | Đúng trong mã. Muốn xảy ra cần hai phiên sinh cùng một tên theo mili giây. Sửa: lưới chỉ xoá khi tên còn đúng OID ca đã thấy |
| P1 | `create()` chỉ ghi tên sau khi có trả lời; kết nối đứt sau khi máy chủ đã tạo thì CSDL không được xoá | **Sửa một phần, có chủ ý.** Lỗi nay nêu tên. Không tự xoá: khi không có trả lời thì không có gì chứng minh CSDL đó là của lượt này, và container dùng chung. Ca `CREATE` hỏng và `M6` giữ nguyên tắc này |
| P1 | Ba ca tạo CSDL trước `try/finally` | Đúng. Lưới dọn chuyển sang `afterEach`, ghi từng CSDL ngay khi tạo |
| P2 | Cửa sổ dò 8 s có thể đỏ giả khi máy chậm | Đúng. 60 s, dừng sớm khi `dropAll()` xong |

## Còn lại, chưa chứng minh được

- **Chưa thấy bản sửa đi qua một lượt chờ checkpoint thật quá 10 s.** Ca «lâu hơn 10 s» dựng bằng khoá `COMMENT ON DATABASE`. Phía client hai trường hợp giống nhau: một `DROP DATABASE` chưa trả lời sau 10 s.
- Lượt chạy bị giết (ngắt phiên, kill tiến trình, tắt máy) trước khi hook chạy vẫn có thể để lại CSDL. Chúng còn hợp lệ (`-1`). Không CSDL nào trong 11 CSDL còn lại thuộc loại này.
- Một bước trước lệnh xoá trong `afterAll` mà không bao giờ trả về thì hook hết hạn sau 600 s và các lệnh xoá không được gửi. Lượt chạy đỏ.
- Một ca hết giờ đúng lúc `create()` đang chạy, rồi `create()` xong sau khi `dropAll()` đã bắt đầu, thì CSDL đó không được xoá và không được nêu tên (lượt chạy đỏ vì ca hết giờ). Chưa thấy lần nào.
- `scripts/native-verification.ts` tạo CSDL `libetech_acceptance_<ms>` (cổng 5547, không phải container này) và không xoá; `scripts/slice1-native-prepare.ts` tạo CSDL cho phiên và cố ý để lại. PR này không đổi chúng.

## Container thử dùng chung

- **Phiên không xoá CSDL nào đã có trước nó.**
- Phiên tạo login và CSDL riêng, hai bộ (bộ đầu mất mật khẩu khi máy khởi động lại), và đã xoá cả hai. CSDL mà lượt đột biến, lỗi tiêm hay lượt thử cố ý để lại cũng đã xoá: trước khi máy khởi động lại, theo tên mà chính thông báo lỗi nêu hoặc theo chủ sở hữu là login của phiên; sau đó theo chủ sở hữu.
- Sau khi máy khởi động lại, phiên bật lại Docker Desktop và `docker start` container thử. PostgreSQL tự phục hồi sau lần tắt không sạch.
- Lúc kết phiên còn: 11 CSDL `-2`; 12 CSDL tên kiểu phiên; `slice1_verify`, `slice1_ui`, `slice2_ui`; và `slice1_verify_971795755832` do một phiên khác tạo lúc 12:03 trong khi cổng đang chạy (không đụng tới). Xoá cái nào trong số này là việc chờ người quyết.
