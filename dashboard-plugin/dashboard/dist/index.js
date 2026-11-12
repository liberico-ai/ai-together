(function () {
  "use strict";
  const SDK = window.__HERMES_PLUGIN_SDK__, R = SDK.React, h = R.createElement;
  async function api(action, data) {
    const response = await SDK.authedFetch('/api/plugins/libetech-ai-os-web/' + action + '?profile=default', {
      method: data === undefined ? 'GET' : 'POST', cache: 'no-store',
      headers: data === undefined ? {} : {'Content-Type': 'application/json'},
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) { const e = new Error(result.error?.message || 'Chưa kết nối được. Thử lại.'); e.code = result.error?.code; throw e; }
    return result.data;
  }
  function Portal() {
    const [me, setMe] = R.useState(null), [workspace, setWorkspace] = R.useState(null);
    const [health, setHealth] = R.useState(null), [error, setError] = R.useState('');
    const [busy, setBusy] = R.useState(false), [code, setCode] = R.useState('');
    const [expires, setExpires] = R.useState(0);
    async function refresh() {
      try { const m = await api('me'); setMe(m); if (m.telegram.linked) setCode(''); setWorkspace(await api('workspace')); }
      catch (e) { if (e.code === 'UNAUTHENTICATED') { setMe(null); setWorkspace(null); setCode(''); } else setError(e.message); }
    }
    R.useEffect(() => { api('health').then(setHealth).catch(e => setError(e.message)); void refresh(); }, []);
    R.useEffect(() => { if (!code) return; const timer = setTimeout(() => setCode(''), Math.max(0, expires - Date.now())); return () => clearTimeout(timer); }, [code, expires]);
    async function login(event) {
      event.preventDefault(); const form = event.currentTarget; setBusy(true); setError('');
      try { const fields = new FormData(form); await api('login', {username: fields.get('username'), password: fields.get('password')}); form.reset(); await refresh(); }
      catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    async function pair() {
      setBusy(true); setError('');
      try { const result = await api('telegram-code', {}); setExpires(Date.now() + result.expiresIn * 1000); setCode(result.code); }
      catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    async function logout() {
      setBusy(true); setError(''); try { await api('logout', {}); setMe(null); setWorkspace(null); setCode(''); }
      catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    const records = workspace?.reconciliations || [];
    return h('main', {className:'ltos-portal'},
      h('header', null, h('div', {className:'ltos-eyebrow'}, 'LIBETECH · KHÔNG GIAN NỘI BỘ'),
        h('h1', null, 'LibeTech AI OS'), h('p', null, 'Đăng nhập tài khoản tổ chức, ghép Telegram và xem hồ sơ đối soát.')),
      h('div', {className:'ltos-status', role:'status'}, health ? 'Server đã kết nối · PostgreSQL · ' + (health.version || '0.2.0') : 'Đang kiểm tra kết nối server…'),
      error && h('p', {className:'ltos-error', role:'alert'}, error),
      !me ? h('section', {className:'ltos-card'}, h('h2', null, 'Đăng nhập'),
        h('p', null, 'Dùng tài khoản LibeTech AI OS đã kích hoạt.'),
        h('form', {onSubmit:login},
          h('label', null, 'Tên đăng nhập', h('input', {name:'username',autoComplete:'username',required:true,defaultValue:'chairman',maxLength:64})),
          h('label', null, 'Mật khẩu', h('input', {name:'password',type:'password',autoComplete:'current-password',required:true,maxLength:128})),
          h('button', {type:'submit',disabled:busy}, busy?'Đang đăng nhập…':'Đăng nhập')))
      : h(R.Fragment, null,
        h('section', {className:'ltos-card'}, h('div', {className:'ltos-row'}, h('h2', null, me.principal.name), h('button', {className:'ltos-secondary',onClick:logout,disabled:busy}, 'Đăng xuất')),
          h('p', null, 'Quyền truy cập theo tài khoản và dự án được giao.'),
          h('h3', null, 'Ghép tài khoản Telegram'),
          me.telegram.linked ? h('p', {role:'status'}, 'Đã ghép Telegram · ' + me.telegram.telegramId) : h(R.Fragment, null,
            h('p', null, 'Mã dùng một lần trong 5 phút. Chỉ gửi riêng cho @LiBeAiTogetherBot.'),
            h('button', {onClick:pair,disabled:busy}, 'Tạo mã ghép 5 phút'),
            code && h('div', {className:'ltos-pair'}, h('p', null, 'Sao chép dòng dưới vào tin nhắn riêng với bot:'),
              h('textarea', {readOnly:true, 'aria-label':'Lệnh ghép riêng Telegram',value:'/libetech_link '+code,rows:3}),
              h('p', null, 'Không gửi mã vào nhóm hoặc vào cuộc trò chuyện Codex.'))),
          h('button', {className:'ltos-secondary',onClick:refresh,disabled:busy}, 'Kiểm tra đã ghép')),
        h('section', {className:'ltos-card'}, h('h2', null, 'Đối soát nguồn · chỉ đọc'),
          h('p', null, 'Bản chụp đối soát không thay thế nghiệm thu kỹ thuật hoặc nghiệp vụ.'),
          records.length ? records.map(row => h('article', {key:row.code+row.source_sha,className:'ltos-record'},
            h('h3', null, row.code), h('p', null, 'SHA nguồn'), h('code', null, row.source_sha),
            h('p', null, 'Nguồn: '+row.source_type+' · '+row.source_id),
            h('p', null, 'Thời điểm nhập: '+row.ingested_at))) : h('p', null, 'Chưa có hồ sơ trong phạm vi được giao.'))),
      h('footer', null, 'Kênh được cấp cho pilot: LibeAI. Nhóm Libe – Xeca không có quyền đọc hồ sơ pilot.'));
  }
  window.__HERMES_PLUGINS__.register('libetech-ai-os-web', Portal);
})();
