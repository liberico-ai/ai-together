# DELIVERY-025 — GIAO VIỆC 5 F, lịch nhắc có ngữ cảnh: bản 0.9.4

Ngày 26/11/2026 · nhánh nền `libetech-ai-os` · phiên Claude Code của GIAO VIỆC 5. Chairman duyệt viết mã F theo đề xuất Q-F1…Q-F4 của `docs/plans/gv5-f-reminders.md` («Yes, build F»).

## Mức của từng mục

Hai mức đầu có bằng chứng ở `docs/reviews/gv5-f-evidence-20261126/`. Hai mức sau chỉ được điền khi có bằng chứng từ d1-ai1 và biên bản nghiệm thu. Phiên này không vào máy chủ, không khởi động lại gateway, không gửi tin vào nhóm nào.

| Mục | Đã có mã | Đã thử trên CSDL thử | Đã triển khai | Đã nghiệm thu với team |
|---|---|---|---|---|
| Phiên nhắc đọc dữ liệu đúng quyền dự án: vai riêng, một dự án mỗi giao dịch | có, PR #51 | có: PGlite và PostgreSQL 16 cục bộ; hai script chạy thật với login riêng | chưa | chưa |
| Trạng thái GO LIVE theo thành viên, nêu tên người thiếu | có | có | chưa | chưa |
| Đổi giờ họp BoM theo tin xác nhận (mã IN); một buổi hoặc cả lịch; không rõ thì hỏi | có | có | chưa | chưa |
| Tin nhắc tới đúng nhóm, có cách kiểm | có | có, tới hàng đi và gateway giả; **chưa tới Telegram** | chưa | chưa |

Không ca lỗi nào được ghi «đã đóng».

## PR, merge, cổng

| PR | Merge | Cổng |
|---|---|---|
| [liberico-ai/ai-together#51](https://github.com/liberico-ai/ai-together/pull/51) | `ad500f5` | Codex một vòng: `CHANGES_REQUIRED`, 2 P0 và 3 P1. Đã sửa cả năm, có ca đỏ trước; Codex chưa đọc lại. Sau đó một lượt đọc độc lập chỉ đọc: không P0; đã sửa các điểm của nó, trừ câu thiết kế Q-GV5F-7 |

- Merge bằng `--match-head-commit`. Merge có hai cha, cây của merge bằng cây của head. `main` vẫn ở `d23e516`; nhánh mặc định vẫn là `main`. PR #47 vẫn là nháp, chưa merge.

## Cổng test trên cây cuối

| Cổng | Kết quả |
|---|---|
| typecheck, build | thoát 0 |
| pytest | 182 đạt, 210 subtest |
| PGlite với coverage | 1622 đạt, 162 bỏ qua; câu lệnh 96,23 %, nhánh 91,88 % |
| PostgreSQL 16 | 1784/1784, không bỏ qua |
| `psql` thật với hai tệp SQL vận hành, rồi hai script | đạt (`logs/scripts-end-to-end.txt`) |

## Bốn câu đề đòi

- **Đọc dữ liệu đúng quyền:** bộ hẹn giờ chạy bằng vai chỉ xếp được tin nhắc, mỗi giao dịch một dự án. Bộ chiếu GO LIVE ghi Z2 chỉ tên và số đếm.
- **Trạng thái GO LIVE:** «đã gửi yêu cầu», «việc đang mở», «việc chưa có bằng chứng ở bản sửa hiện tại». Cách tính: Q-GV5F-4.
- **Đổi giờ họp:** người ghi là ghế BoM dự án hoặc BoM Tech, trên web, kèm mã IN của tin đã lưu trong chính dự án. Không máy nào đọc chữ tin để đổi.
- **Tới đúng nhóm:** nhóm phải phục vụ đúng một dự án, là dự án của tin. CSDL, bộ hẹn giờ, lượt kéo và gateway đều kiểm. Cách kiểm: `--status`, biên nhận gửi, người nhận xác nhận (runbook §5.5).

## Các ca lỗi

| Ca | Đã làm | Đối chiếu với người báo |
|---|---|---|
| (e) đổi giờ họp BoM | Có chỗ ghi, có nguồn, áp đúng một buổi hay cả lịch | chưa (EV-07, EV-34) |
| (f) phiên nhắc theo lịch không đọc được lịch sử nhóm | Bộ hẹn giờ không cần lịch sử nhóm; nó đọc dữ liệu đã lưu. Nguyên nhân của phiên cũ vẫn chưa rõ | chưa (EV-08) |

## Cần Chairman hay BoM quyết, trước khi bật (không chặn việc nâng bản)

- **Q-GV5F-1:** bật timer của bộ chiếu, vốn giữ login vận hành, hay chạy tay mỗi sáng.
- **Q-GV5F-6:** nhóm chung Team Tech có nhận tin nhắc không. Hiện bị từ chối.
- **Q-GV5F-7:** tin GO LIVE của một dự án xét cả roster, hay chỉ người của dự án.
- Q-GV5F-2…5: đổi ngày họp, ngày lễ, cách tính, các mốc giờ.

## Bản 0.9.4

- Tệp: `~/Documents/libetech-releases/libetech-ai-os-0.9.4-20261126.tar.gz`, đóng gói từ merge `ad500f5` trong một worktree sạch bằng `scripts/package-release.py`. 427 tệp, gồm migration 031 kèm rollback, hai tệp SQL vận hành, hai cặp unit, và plugin **0.3.6**.
- SHA-256 của tệp: `7fe9cd20fc26201211c9396b003454dc6132344ed8a535b054d55d9c596fa9d7` (tệp `.sha256` nằm cạnh; `shasum -a 256 -c` báo OK).
- `treeSha256`: `7734f994d6330ac24f4fca5ab2bd3f35f782239da3a47c9cdb80422d6cbc1fd9`. `deploy/verify-bundle.py` báo `Bundle verified` trên bản giải nén.
- Runbook: `docs/RUNBOOK-094-20261126.md`.
  - **Plugin đổi, nên phải khởi động lại gateway chung**: ngoài giờ, có lời Chairman.
  - Nâng bản **không** bật tin nhắc.
  - Quay lại 0.9.3 chỉ khi không còn tin nhắc chờ (§7).

## Vướng và còn lại

- Chưa triển khai và chưa nghiệm thu. Bằng chứng cần lấy: EV-07, EV-08, EV-33…EV-36.
- Hồ sơ triển khai 022/023 và 0.9.1, 0.9.2 vẫn chưa có trong repo.
