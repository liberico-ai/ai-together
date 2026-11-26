VERDICT: CHANGES_REQUIRED

- [P0] migrations/032_definer_search_path.sql:32 — Câu canh chấp nhận `pg_temp` xuất hiện trước một schema ứng dụng, nên có thể bỏ lọt hàm `SECURITY DEFINER` cho phép bảng tạm che bảng thật.
  Kịch bản: Một hàm có sẵn ngoài migration dùng `search_path=pg_catalog,pg_temp,public,pg_temp` và đọc bảng không chỉ rõ schema → người gọi tạo bảng tạm cùng tên → 032 vẫn commit. Thử trên PGlite xác nhận hàm đọc bảng tạm; phép kiểm ở `tests/definer-search-path.test.ts:19` cũng chấp nhận cấu hình này.
  Căn cứ: Yêu cầu 032 phải dừng nếu còn hàm quyền cao chưa ghim `pg_temp` an toàn ở cuối; mục kiểm 1 và 3.