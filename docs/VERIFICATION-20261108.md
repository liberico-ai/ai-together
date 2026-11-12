# Kiểm chứng foundation — 08/11/2026

## Phạm vi

Mã mới `libetech-ai-os` 0.1.0; máy local; dữ liệu hoàn toàn mô phỏng; schema `001`. Không phải kiểm bot LibeTech/Hermes/GitHub App đang chạy. Chưa có Git commit nên `/api/health.sourceSha = null`, không tự gắn SHA của repo khác.

## Kết quả đã quan sát

| Hạng mục | Kết quả / bằng chứng |
|---|---|
| TypeScript | `npm run typecheck` PASS |
| Build | `npm run build` PASS, không còn warning truy vết runtime data |
| Automated tests | 19/19 PASS, `tests/foundation.test.ts`, chạy 15:44–15:45 VN |
| Coverage phạm vi được đo | `service.ts`, `auth.ts`, `http.ts`: statements 96.5%, branches 88.97%, functions 100%, lines 98.64%; không phải coverage toàn bộ UI/DB adapter |
| RLS | Bảy bảng có tenant/project scope; không context không có hàng; tenant khác/project khác không đọc được hàng ngoài quyền; insert chéo bị chặn |
| State / authority | Bot/khách không ghi; không tự nghiệm thu; sai người/SHA/revision/bằng chứng bị chặn; hoàn thành cần hai nghiệm thu |
| Concurrency / retries | Hai ghi cùng version chỉ một commit; version cũ không thêm event; cùng key trả lại kết quả cũ; dùng key cho nội dung khác bị từ chối |
| History / persistence | UPDATE/DELETE audit/evidence dưới role runtime bị chặn; DB tạm đóng rồi mở lại vẫn giữ version và sự kiện |
| HTTP trên tiến trình thật | 15:51 VN: health 0.1.0/schema001; manager 6 việc; bot chỉ 1 việc Vận tải; thiếu phiên 401; đọc việc Bán hàng 404/SCOPE_DENIED; bot ghi 403/READ_ONLY |
| Browser lifecycle | Manager thử hoàn thành `LT-DEMO-014` khi thiếu xác nhận → ACCEPTANCE_REQUIRED. Đổi vai kỹ thuật → lưu acceptance. Vai nghiệp vụ thêm UAT → lưu acceptance. Manager hoàn thành → r1/v5, state done, hai acceptance hợp lệ |
| Browser create/search | Tạo `LT-DEMO-UI-001` từ form; tìm mã trả đúng một hàng; hồ sơ trạng thái planned r1/v1 |
| Browser bot scope | Vai bot Vận tải chỉ có LT-DEMO-018, không thấy việc Bán hàng hoặc nút tạo |

Các event từ phép thử UI ghi rõ “mô phỏng”; không được dùng làm bằng chứng nghiệm thu công việc thật.

## Lỗi được phát hiện và sửa

1. Kiểm Origin từ `Request.url` bị lệch khi Next chuẩn hóa host nội bộ. Sửa so Origin với Host loopback đã kiểm; bỏ qua forwarded headers; thêm regression test đồng thời chặn origin bên ngoài.
2. Cửa sổ thấp làm menu Dev Factory nằm ngoài viewport. Bổ sung cuộn thanh điều hướng.
3. Giới hạn tràn ngang ở root, giữ bảng cuộn ngang trong vùng bảng; tăng tương phản phần chữ phụ.

## Kiểm chứng sau bàn giao đường dẫn

Đã chuyển mã và kho dữ liệu local sang `/Users/huyenleduy/Documents/GitHub/libetech-ai-os`, khởi động lại bằng `npm start` tại `127.0.0.1:3147`.

- 15:57 VN: `LT-DEMO-UI-001` còn nguyên trạng thái planned; `LT-DEMO-014` còn r1/v5, done, hai acceptance hợp lệ và 5 audit events. Xem `RUNTIME-RECEIPT-20261108.json`.
- HTTP smoke sau restart PASS, receipt `HTTP-SMOKE-20261108.json`; bot vẫn chỉ đọc một dự án và bị chặn ghi.
- Menu Dev Factory đã mở được ở cửa sổ thấp sau sửa. Màn hình ghi rõ “Thiết kế đích · Chưa kết nối”.
- Mobile 390×844: dashboard chuyển hai cột chỉ số; menu mở/chọn Hệ thống được; body/app-shell rộng 390px, bảng cuộn trong vùng riêng. Chưa chạy bộ kiểm accessibility tự động; không tuyên bố WCAG conformance.
- Bản build cuối và typecheck PASS sau sửa CSS. `npm audit --omit=dev`: 0 lỗ hổng đã biết tại thời điểm kiểm.
- Tab Chrome đã giữ ở dashboard để xem; đây là tiến trình local thủ công, chưa cài auto-start/daemon.
- 28 tệp source/config được đối chiếu SHA-256 khi di chuyển. `SOURCE-MANIFEST.json` là digest cây tệp, không phải Git commit. Chưa có commit, remote hoặc push.

Ảnh: `screenshots/LibeTech-AI-OS-dashboard.jpg`, `screenshots/LibeTech-AI-OS-factory.jpg`, `screenshots/LibeTech-AI-OS-bot-scope.jpg`, `screenshots/LibeTech-AI-OS-mobile.jpg`.

## Giới hạn

Chưa có test trên PostgreSQL server/pg.Pool, production auth, load/HA, restore production, nguồn GitHub/Vault/Telegram hoặc UAT bởi người dùng nghiệp vụ. Màn hình vận hành/Factory chỉ rõ phần chưa kết nối. Đây là một foundation có hoạt động, chưa phải toàn bộ AI OS production.
