# Triển khai SPEC-003 — LibeTech AI OS 0.3.0

Bản 0.3.0 đã được build và kiểm trên PostgreSQL 16 cô lập lúc 16:25 giờ Việt Nam ngày 09/11/2026. Kết quả gồm cổng web riêng, vòng đời tài khoản, quyền theo dự án, ghép Telegram qua cầu nối ký trong môi trường thử và hai dashboard. Biên nhận `SPEC-003-VERIFICATION-20261109.json:2`, `SPEC-003-VERIFICATION-20261109.json:12` và `SPEC-003-VERIFICATION-20261109.json:29`.

**Cập nhật tối 09/11.** HTTPS đã qua phép thử chuẩn, `/login` trả 200 và HTTP chuyển hướng 301. Quân báo Nginx ở `192.168.17.10` đang phục vụ AiTogether cũ qua 7060. Kết quả này cập nhật phép thử lỗi chứng chỉ lúc 16:18. Nguồn `SPEC-003-LAB-READBACK-20261109.json:4` và `SPEC-003-VERIFICATION-20261109.json:41`.

**Ứng viên 0.3.0 đã build trên d1-ai1.** Biên nhận trong thư mục release có build ID `Y2InRk4-ogLI6yxITa1Tf`. Phép đo sau build ở loopback 3148 vẫn trả 0.2.0 và schema 001–003. Nguồn `SPEC-003-LAB-READBACK-20261109.json:24` và `SPEC-003-LAB-READBACK-20261109.json:34`.

**Tuyến qua Nginx cũ dừng ở bước kiểm kết nối.** Quân báo hai máy ở hai trung tâm dữ liệu và tuyến riêng không thông. Giữ AiTogether cũ qua 7060. Báo cáo vận hành tại `SPEC-003-EDGE-READBACK-20261109.json:4` và phép đo trước đó tại `SPEC-003-LAB-READBACK-20261109.json:17`.

## Phương án cổng HTTPS phía d1-ai1

**Đề xuất** dùng cổng riêng `libetech.btnet.vn` ở cùng phía đầu vào với d1-ai1. Phép đo `hermes.btnet.vn` trả 302 qua Cloudflare, còn tên đề xuất có DNS nhưng `/login` trả 404. Cần chủ quản DNS xác nhận tên và cấu hình hiện có. Kiểm hai dịch vụ và tiến trình theo tên trên d1-ai1 chưa xác định được nơi đặt đầu vào của Hermes. Nguồn `SPEC-003-EDGE-READBACK-20261109.json:9`, `SPEC-003-EDGE-READBACK-20261109.json:19` và `SPEC-003-EDGE-READBACK-20261109.json:29`.

1. Đầu mối Cloudflare hoặc reverse proxy của `btnet.vn` xác nhận quyền quản trị, đường đến d1-ai1 và tên dự kiến. Ưu tiên đầu vào đã được quản trị ở cùng trung tâm. Nếu cần Cloudflare Tunnel riêng, dùng connector đặt tại phía d1-ai1 và bản ghi hostname trong đúng tài khoản quản trị. [Tài liệu tuyến ứng dụng](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/) · [Điều kiện DNS](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/).
2. Cấu hình vhost riêng cho Team Tech đi qua proxy chỉ dành cho web đến AI OS. Dùng TLS và `Host` đúng tên đã duyệt. Giữ bridge, PostgreSQL và các đường quản trị Hermes ở phạm vi hiện hành. Đặt `LIBETECH_TEAM_ORIGIN` theo tên được chốt và giữ origin Hermes. Nguồn hợp đồng origin `../src/server/auth.ts:18`.
3. Chỉ kích hoạt 0.3.0 sau khi kiểm đường từ đầu vào mới tới backend riêng. Kiểm HTTPS, health đúng bản/digest và schema 004–005, kiểm quyền dự án và thử đăng nhập, ghép Telegram của Quân và Phương. Dùng bản đọc LBRC014 để đối chiếu. Khi tuyến mới lỗi, tắt vhost mới, kiểm lại cổng Hermes và quay bản web nếu cần. Phạm vi bảng việc là chỉ đọc.

### Bàn giao Cloudflare cho Quân

Quân là đầu mối Cloudflare/DNS của `btnet.vn` theo thông tin Chairman vừa xác nhận. Tên đề xuất cho đợt thử là `libetech.btnet.vn`. Biên nhận DNS và HTTPS tại `SPEC-003-EDGE-READBACK-20261109.json:19`.

**Quân chuẩn bị trên Cloudflare**

1. Kiểm bản ghi chính xác, wildcard và các route hiện có của `libetech.btnet.vn`. Xác nhận có thể dành tên này cho Team Tech.
2. Tra đường đang phục vụ `hermes.btnet.vn`. Gửi tên tunnel hoặc proxy, nơi chạy connector và máy:cổng upstream hiện tại. Nếu đầu vào đó tới được d1-ai1, có thể dùng chung hạ tầng với một tuyến riêng cho Team Tech. Nếu cần connector mới, tạo tunnel riêng `libetech-team-d1` ở bước chuẩn bị và phối hợp đầu mối d1-ai1 để chạy connector tại phía đó. Giữ Published application route ở bước chờ tới khi xác nhận đầu nhận và phạm vi truy cập. [Hướng dẫn tạo tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/).
3. Khi gắn hostname, dùng đúng URL **proxy web** do đầu mối d1-ai1 xác nhận. Giới hạn pilot cho Quân, Phương và tài khoản kiểm thử được duyệt theo cơ chế truy cập của tổ chức. Giữ TLS, Host gốc và tránh cache các đường dẫn phiên. Xác minh bridge bị chặn trên tuyến Team Tech. Hợp đồng origin tại `../src/server/auth.ts:18`, endpoint nội bộ tại `../src/app/api/bridge/route.ts:7`. [Cấu hình tuyến ứng dụng](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/).

**Đầu mối AI OS chuẩn bị phía d1-ai1**

- Xác nhận nơi chạy connector, mở đầu nhận web riêng trong phạm vi được duyệt và kiểm từ chính máy connector. Cổng 3148 là loopback của d1-ai1, địa chỉ loopback trên máy khác chỉ tới máy đó. Bản đọc backend tại `SPEC-003-LAB-READBACK-20261109.json:34`.
- Thông tin Quân gửi gồm tên tunnel, vị trí và trạng thái connector. Token theo quy trình quản trị bí mật tại d1-ai1.
- Sau khi tuyến web đạt, cấu hình origin đã chốt, sao lưu và nâng AI OS lên 0.3.0 theo các bước dưới. Kiểm chính xác phiên bản/digest, schema 004–005, endpoint phiên chưa đăng nhập trả 401 và bridge bị chặn ở cổng team. Sau đó mở lời mời riêng cho Quân và Phương, ghép Telegram và kiểm LBRC014 với quyền hiện có. Bảng việc chỉ phục vụ đối chiếu. Tiêu chí bản thử tại `SPEC-003-VERIFICATION-20261109.json:4` và `SPEC-003-VERIFICATION-20261109.json:12`.

**Kết quả cần nhận từ Quân** gồm hostname có thể dùng, tên và vị trí tunnel/proxy hiện hữu, và máy:cổng đích mà đầu vào đó tới được. Nếu tạo tunnel mới, gửi thêm trạng thái connector sau khi được cài phía d1-ai1.

## Phần đã kiểm

| Phần | Bằng chứng |
|---|---|
| A01–A02 | Tạo lời mời, kích hoạt, đăng nhập, từ chối dùng lại mã và gửi khác origin, ghép Telegram riêng bằng yêu cầu ký, thu hồi quyền ở web và bridge. `SPEC-003-VERIFICATION-20261109.json:12`. |
| A03 và E03 | Người có dự án xem LBRC014, người ngoài dự án bị chặn, người chưa được cấp quyền nhân sự bị từ chối xem kết quả của người khác. `SPEC-003-VERIFICATION-20261109.json:15`. |
| E01–E02 | Điểm 54,17 từ dữ liệu giả lập. Cùng bằng chứng xuất hiện trên dự án và điểm cá nhân. Nhập lặp không tăng điểm. Rà soát có dấu vết và cho ra lần tính kế tiếp, bản cũ còn truy được. `SPEC-003-VERIFICATION-20261109.json:16`. |
| Hồ sơ thật | LBRC014 hiển thị “Hoàn thành” theo bảng việc và “Chờ xác nhận người dùng” theo hồ sơ, sáu mục bằng chứng, điểm nhân sự chưa đủ căn cứ. `SPEC-003-VERIFICATION-20261109.json:19`. |

Đã đọc hồ sơ LBRC014 đã lưu để tạo dữ liệu dẫn xuất. Dùng `scripts/lbrc014-report.ts` để xuất lại cùng bản quan sát, rồi `scripts/project-evidence.ts` để nhập vào kho LibeTech đã được duyệt. Quyền đọc PR/review theo repo, thu Telegram định kỳ, lịch/SLA và công thức chính thức là các cấu hình tiếp theo theo phạm vi được giao.

## Thứ tự triển khai vào máy chủ

Tham chiếu triển khai backend. Tên miền áp dụng theo phương án được duyệt ở trên.

1. Cùng người quản trị tuyến cũ xác nhận Nginx, DNS, vhost và chứng chỉ khớp `ai-together.lab.liberico.com.vn`. Xác nhận dịch vụ cũ đang phục vụ và cách giữ tuyến đó trước khi trỏ `/login` vào 0.3.0. Kiểm `curl -I https://ai-together.lab.liberico.com.vn/login` với kiểm tra chứng chỉ mặc định.
2. Lưu cấu hình, phiên bản ứng dụng và bản sao PostgreSQL của AI OS vào chỗ riêng có giới hạn quyền. Kiểm khôi phục trên DB thử. Kiểm hash gói, giải nén vào thư mục release mới, cài từ lockfile và chạy `npm run build -- --webpack`.
3. Dùng tài khoản migration của **chính DB AI OS** chạy `node --import tsx scripts/migrate.ts`. Trên pilot 0.2.0 đã có 001–003, phần nâng cấp dự kiến là 004–005. Đọc lại phiên bản schema, tài khoản hiện hữu, quyền PostgreSQL và bản đối soát cũ trước khi trỏ cổng.
4. Giữ `LIBETECH_ORIGIN` của Hermes và đặt `LIBETECH_TEAM_ORIGIN=https://ai-together.lab.liberico.com.vn` cho cổng team. Đặt `LIBETECH_ACCOUNT_ADMIN_ID` bằng UUID tài khoản quản trị được duyệt, tra bằng metadata DB. Thành viên dùng đường HTTPS riêng, `/login`, `/activate`, `/reports` và các API phiên/tài khoản/báo cáo tương ứng. Giới hạn reverse proxy vào upstream riêng. Bridge và DB dùng đường nội bộ. Kiểm yêu cầu từ cổng web bằng đúng Host/Origin, cookie Secure và nonce CSP.
5. Mở thử với Quân và Phương trước. Đề xuất Quân vai thực hiện, Phương vai điều phối tại LBRC · App Saleman. Tách quyền xem điểm, đánh giá và chốt kết quả theo người được giao. Các thành viên còn lại cấp theo danh sách và dự án thực tế. Tạo từng lời mời qua `/team`, người dùng tự đặt mật khẩu và ghép Telegram riêng.
6. Kiểm trên đường dùng thật. Một tài khoản mới đăng nhập, ghép bot qua tin riêng, vào được LBRC và bị chặn ngoài dự án. Chạy lại hai dashboard trên bản đối soát LBRC014, rồi xác nhận phạm vi người xem và dữ liệu nguồn trước khi mở rộng 5–6 tài khoản.

**Quay lại bản trước khi cần.** Trỏ dịch vụ web AI OS về thư mục release và cấu hình trước, giữ dữ liệu và các migrations bổ sung. Kiểm health và cầu nối cũ bằng bản thử có quyền. Thao tác app và proxy do đúng đầu mối của từng dịch vụ. Mỗi lần quay lại có biên nhận.

## Bàn giao tuyến Nginx trước đây (tạm dừng)

Tuyến dự kiến là `Nginx 192.168.17.10 → 127.0.0.1:7318 trên máy Nginx → SSH 10.10.1.26:22 → 127.0.0.1:3148 trên d1-ai1`. Cổng 7318 là lựa chọn cho bản thử, kiểm tra còn trống trước khi dùng. Nginx giữ cấu hình upstream 7060 đã lưu cho tới khi health 0.3.0 qua tuyến riêng đạt. Số liệu hiện có là biên nhận tối 09/11, xem `SPEC-003-LAB-READBACK-20261109.json:17` và `SPEC-003-LAB-READBACK-20261109.json:34`.

### A. Quân kiểm tuyến và chuẩn bị SSH

Quân dùng hai lệnh dưới đây trên máy Nginx.

```bash
nc -vz -w 3 10.10.1.26 22
ss -H -lnt 'sport = :7318'
```

Nếu cổng SSH hết thời gian chờ, gửi kết quả và nhờ quản trị mạng xác định tuyến riêng giữa hai dải. Cổng 7318 cần trống. Nếu TCP 22 tới được, Quân tạo khóa dịch vụ trên máy Nginx, cung cấp khóa công khai qua kênh nội bộ và giữ khóa riêng tại máy đó. Đầu mối SSH d1-ai1 xác minh dấu vân tay máy chủ và cấp tài khoản chuyển tiếp riêng trước khi thử. Quyền chỉ gồm chuyển tiếp TCP cục bộ tới đúng `127.0.0.1:3148`, với phiên shell/SFTP, PTY, chuyển tiếp từ xa và agent bị tắt. Quản trị viên kiểm cấu hình theo đúng tài khoản và địa chỉ nguồn thực tế. Tham chiếu [OpenSSH sshd_config](https://man.openbsd.org/sshd_config.5) và [tùy chọn khóa OpenSSH](https://man.openbsd.org/sshd.8).

Mẫu lệnh thử ở foreground sau khi có tài khoản, khóa và host key đã xác minh. `libetech-tunnel` là tên đề xuất. Chạy bằng user dịch vụ trên máy Nginx và chọn đúng khóa của user đó.

```bash
ssh -NT -p 22 \
  -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
  -L 127.0.0.1:7318:127.0.0.1:3148 \
  libetech-tunnel@10.10.1.26
```

**Phép thử health từ cửa sổ thứ hai trên máy Nginx.**

```bash
ss -H -lnt 'sport = :7318'
curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:7318/api/health
```

Tuyến đạt ở bước A khi cổng chỉ lắng nghe ở `127.0.0.1:7318` và health trả dữ liệu LibeTech hiện hữu. Phiên bản kỳ vọng trước khi đổi dịch vụ là 0.2.0 với `postgresql-server` theo biên nhận `SPEC-003-LAB-READBACK-20261109.json:34`. Quân gửi đầu ra `nc`, `ss` và health. Trước khi chuyển Nginx, quản lý tunnel bằng dịch vụ riêng có tự khởi động lại, thử ngắt/kết nối lại và xác nhận health phục hồi. [Tham chiếu lệnh SSH](https://man.openbsd.org/ssh.1)

### B. Chuyển backend rồi chuyển Nginx

Sau khi bước A đạt, đầu mối AI OS thực hiện mục triển khai ở trên. Sao lưu và kiểm bản khôi phục của PostgreSQL AI OS, áp migrations 004–005, cấu hình origin của Team Tech, rồi kích hoạt bản build đã kiểm ở cổng 3148. Đường dẫn và hash bản đã build tại `SPEC-003-LAB-READBACK-20261109.json:24`. Kiểm localhost 3148 và tunnel 7318 cùng trả `data.version = 0.3.0`, `data.storage = postgresql-server`, schema gồm 004 và 005. Đối chiếu `data.buildDigest` với `d9dbaaf3d4fae8fdb34c6a258c93347109ce598f7e74894179724c1a1cfa4521` và kiểm lại cổng Hermes trước khi báo Quân chuyển tuyến.

Quân lưu cấu hình hiện tại và chỉnh đúng vhost HTTPS của Team Tech. Mẫu sau để hợp nhất vào các `location` hiện có. Giữ cấu hình TLS, chuyển hướng HTTP và phạm vi truy cập đã cấp của vhost.

```nginx
location = /api/bridge { return 404; }
location ^~ /api/bridge/ { return 404; }

location / {
    proxy_pass http://127.0.0.1:7318;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache off;
}
```

Chạy `sudo nginx -t` trước `sudo systemctl reload nginx`. Kiểm từ phía người dùng với HTTPS xác minh mặc định. `/login` hiển thị 0.3.0, `/api/auth/me` khi chưa đăng nhập trả 401, `/api/bridge` trên vhost trả 404. Đường PostgreSQL và bridge tiếp tục sử dụng kết nối nội bộ. [Tham chiếu Nginx proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)

### C. Nghiệm thu và quay lại nếu có lỗi

- Quân và Phương nhận lời mời riêng qua tài khoản quản trị Team Tech, tự đặt mật khẩu trên HTTPS rồi tự gửi mã ghép trong tin nhắn riêng với bot. Đọc lại trạng thái ghép trên web và kiểm quyền theo dự án LBRC của từng người.
- Đọc LBRC014 ở đúng SHA `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab` trong LibeAI và kiểm chặn từ Libe–Xeca. Quan sát dashboard dự án giữ trạng thái nguồn “Hoàn thành” và phần nghiệm thu người dùng còn chờ. Bảng việc của team dùng để đối chiếu chỉ đọc. Mốc hồ sơ nguồn tại `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:321`.
- Điều kiện quay lại là lỗi HTTPS, đăng nhập hoặc quyền sau đổi tuyến. Quân dùng cấu hình đã lưu cho upstream 7060, kiểm `nginx -t`, reload và kiểm trang cũ. Mốc cấu hình cũ tại `SPEC-003-LAB-READBACK-20261109.json:15`. Nếu lỗi nằm ở dịch vụ AI OS, khôi phục bản web trước và xác nhận bridge. Giữ migrations bổ sung và bản sao PostgreSQL để đối soát, tránh khôi phục dữ liệu đè lên các thay đổi sau chuyển tuyến.

## Tái hiện trong môi trường thử

Dùng PostgreSQL 16 cô lập trên loopback 35447 với DB `spec003_verify` và tệp xác thực riêng. `scripts/spec003-native-prepare.ts` kiểm đúng tên DB và tài khoản thử, cài schema, tạo danh tính thử và nhập hồ sơ LBRC014. Khởi động app với env thử trên loopback 3348. `scripts/spec003-native-verify.ts` chạy qua HTTP, lưu biên nhận không chứa mật khẩu và token. Chứng cứ của lần chạy: `SPEC-003-VERIFICATION-20261109.json:1`.
