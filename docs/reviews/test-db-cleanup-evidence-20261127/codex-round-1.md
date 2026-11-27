VERDICT: CHANGES_REQUIRED

- [P0] `tests/test-databases.test.ts:18` — Lượt dọn dự phòng có thể xoá CSDL của phiên khác vì xoá lại theo tên sau khi `dropAll()` đã thành công.
  Kịch bản: Phiên A xoá CSDL của mình; phiên B tạo CSDL trùng tên trước khi A chạy `remove()` → A dùng `WITH (FORCE)` xoá CSDL của B. Tên chỉ dựa vào mili giây và bộ đếm riêng từng phiên (`tests/test-databases.ts:30`).
  Căn cứ: Yêu cầu container dùng chung: chỉ xoá CSDL do chính lượt kiểm tạo.

- [P1] `tests/test-databases.ts:32` — `create()` chỉ ghi nhận tên sau khi kết nối trả kết quả, nên có thể mất dấu một CSDL đã tạo.
  Kịch bản: PostgreSQL tạo CSDL xong nhưng kết nối đứt trước khi client nhận kết quả → `create()` ném lỗi, tên không vào `created`, `dropAll()` không xoá được. Lượt chạy đỏ nhưng để lại CSDL.
  Căn cứ: Yêu cầu CSDL thử không bị bỏ lại; kiểm đường lỗi của `create()`.

- [P1] `tests/test-databases.test.ts:25` — Ba ca tạo CSDL trước khối `try/finally`, nên không tự dọn trên lỗi thiết lập.
  Kịch bản: `connected()` lỗi sau khi tạo CSDL ở ca đầu, hoặc lần `create()` thứ hai lỗi ở hai ca sau (`:47`, `:72`) → không chạy `remove()`, để lại CSDL.
  Căn cứ: Yêu cầu ba ca tự dọn khi hỏng trên container dùng chung.

- [P2] `tests/test-databases.test.ts:55` — Mốc dò 8 giây có thể làm ca ngắt kết nối đỏ giả khi máy chủ chậm.
  Kịch bản: Kết nối dùng để gửi `DROP` mất hơn 8 giây mới vào trạng thái chờ khoá → phép dò kết thúc và assertion ở `:57` thất bại, dù `dropAll()` chưa thể hiện lỗi cần kiểm.
  Căn cứ: Yêu cầu ca kiểm thực sự kiểm hành vi đã tuyên bố.

