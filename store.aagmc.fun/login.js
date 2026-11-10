/* AAG SMP - Minecraft username login + top-corner account widget.
   Config: config.js (apiUrl). */
(function () {
  var KEY = 'aag_user';
  var CFG = window.AAG_CONFIG || {};
  var NAME_RE = { java: /^[A-Za-z0-9_]{3,16}$/, bedrock: /^\.?[A-Za-z0-9_ ]{1,16}$/ };

  var store = {
    get: function () {
      var v = null;
      try { v = localStorage.getItem(KEY); } catch (e) {}
      if (!v && window.name && window.name.indexOf(KEY + '=') === 0) v = window.name.slice(KEY.length + 1);
      try { var o = JSON.parse(v); return o && o.name ? o : null; } catch (e) { return null; }
    },
    set: function (u) {
      var s = JSON.stringify(u);
      try { localStorage.setItem(KEY, s); } catch (e) {}
      window.name = KEY + '=' + s;
    },
    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      if (window.name && window.name.indexOf(KEY + '=') === 0) window.name = '';
    }
  };

  // Server ko request (sirf tab jab config.js me apiUrl set ho)
  function api(path, body, timeoutMs) {
    if (!CFG.apiUrl) return Promise.resolve(null);
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 5000) : null;
    return fetch(CFG.apiUrl.replace(/\/+$/, '') + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); })
      .catch(function () { return null; })
      .then(function (d) { if (t) clearTimeout(t); return d; });
  }

  function safeNext(n) {
    if (!n) return 'rewards';
    var clean = n.replace(/\.html$/, '');
    return /^[A-Za-z0-9_\-]+$/.test(clean) ? clean : 'rewards';
  }
  function currentFile() {
    var f = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    return f === 'index' ? '' : f;
  }

  function validate(name, edition) {
    if (!name || typeof name !== 'string') return false;
    name = name.trim();
    if (edition === 'bedrock') {
      var clean = name.replace(/^\.+/, '');
      return clean.length >= 1 && clean.length <= 16 && /^[A-Za-z0-9_ ]+$/.test(clean);
    }
    return !!NAME_RE[edition] && NAME_RE[edition].test(name);
  }

  function login(name, edition) {
    name = (name || '').trim();
    if (edition === 'bedrock') {
      name = name.replace(/^\.+/, ''); // Normalize to clean gamertag (no dot required)
    }
    var user = { name: name, edition: edition, at: Date.now() };
    store.set(user);
    try { if (window.AAG_onLogin) window.AAG_onLogin(user); } catch (e) {}
    return api('/api/login', { name: name, edition: edition }).then(function (res) { return { user: user, saved: !!(res && res.ok) }; });
  }

  // ---------- top-corner widget ----------
  var CSS = '' +
  '#aag-acc{position:fixed;top:16px;right:16px;z-index:9000;font-family:"proxima-nova",Arial,sans-serif}' +
  '#aag-acc .aag-btn{display:inline-flex;align-items:center;gap:10px;border:0;cursor:pointer;color:#fff;font:700 15px "proxima-nova",Arial,sans-serif;text-decoration:none;border-radius:999px;box-shadow:0 2px 14px rgba(0,0,0,.45)}' +
  '#aag-acc .aag-login{background:#0a6cff;padding:11px 22px}' +
  '#aag-acc .aag-login:hover{background:#1a79ff}' +
  '#aag-acc .aag-user{background:#1e1e1e;padding:6px 14px 6px 6px;border:1px solid #2e2e2e}' +
  '#aag-acc .aag-user:hover{background:#2a2a2a}' +
  '#aag-acc .aag-av{width:30px;height:30px;border-radius:50%;background:#0a6cff;display:grid;place-items:center;font-size:14px;font-weight:800;text-transform:uppercase}' +
  '#aag-acc .aag-nm{line-height:1.1;text-align:left}' +
  '#aag-acc .aag-nm small{display:block;font-weight:400;font-size:11px;color:#4ade80}' +
  '#aag-acc .aag-caret{width:10px;height:10px;fill:none;stroke:#9a9a9a;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
  '#aag-acc .aag-menu{display:none;position:absolute;right:0;top:calc(100% + 8px);min-width:220px;background:#1e1e1e;border:1px solid #2e2e2e;border-radius:18px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.55);color:#fff}' +
  '#aag-acc.open .aag-menu{display:block}' +
  '#aag-acc .aag-menu p{margin:0 0 2px;font-size:12px;color:#9a9a9a}' +
  '#aag-acc .aag-menu b{display:block;font-size:17px;margin-bottom:2px;word-break:break-all}' +
  '#aag-acc .aag-menu span{display:block;font-size:13px;color:#4ade80;margin-bottom:14px}' +
  '#aag-acc .aag-out{width:100%;justify-content:center;background:#2c2c2c;padding:10px 16px;border-radius:12px}' +
  '#aag-acc .aag-out:hover{background:#3a3a3a}' +
  '@media(max-width:520px){#aag-acc{top:10px;right:10px}#aag-acc .aag-nm{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}';

  function mountWidget() {
    if (document.getElementById('aag-acc')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var box = document.createElement('div'); box.id = 'aag-acc';
    var u = store.get();
    if (!u) {
      var a = document.createElement('a'); a.className = 'aag-btn aag-login';
      var nextParam = currentFile();
      a.href = 'login' + (nextParam ? ('?next=' + encodeURIComponent(nextParam)) : '');
      a.textContent = 'Login';
      box.appendChild(a);
    } else {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'aag-btn aag-user';
      var av = document.createElement('span'); av.className = 'aag-av'; av.textContent = u.name.replace(/^\./, '').charAt(0) || '?';
      var nm = document.createElement('span'); nm.className = 'aag-nm';
      nm.appendChild(document.createTextNode(u.name));
      var sm = document.createElement('small'); sm.textContent = '● Logged in'; nm.appendChild(sm);
      b.appendChild(av); b.appendChild(nm);
      b.insertAdjacentHTML('beforeend', '<svg class="aag-caret" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>');
      var menu = document.createElement('div'); menu.className = 'aag-menu';
      var p = document.createElement('p'); p.textContent = 'Logged in as';
      var bn = document.createElement('b'); bn.textContent = u.name;
      var ed = document.createElement('span'); ed.textContent = (u.edition === 'bedrock' ? 'Bedrock' : 'Java') + ' Edition';
      var changeBtn = document.createElement('a');
      changeBtn.className = 'aag-btn';
      changeBtn.style.cssText = 'width:100%; justify-content:center; background:#0a6cff; padding:9px 16px; border-radius:12px; margin-bottom:8px; font-size:13px; font-weight:700;';
      changeBtn.textContent = 'Switch Username';
      changeBtn.href = 'login?change=1&next=' + encodeURIComponent(currentFile());
      changeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.AAG.logout();
        window.location.href = 'login?change=1&next=' + encodeURIComponent(currentFile());
      });

      var out = document.createElement('button'); out.type = 'button'; out.className = 'aag-btn aag-out'; out.textContent = 'Log out';
      out.addEventListener('click', function () { window.AAG.logout(); location.reload(); });
      menu.appendChild(p); menu.appendChild(bn); menu.appendChild(ed); menu.appendChild(changeBtn); menu.appendChild(out);
      b.addEventListener('click', function (e) { e.stopPropagation(); box.classList.toggle('open'); });
      document.addEventListener('click', function (e) { if (!box.contains(e.target)) box.classList.remove('open'); });
      box.appendChild(b); box.appendChild(menu);
    }
    document.body.appendChild(box);
  }


  // ---------- code links / redeem (server ho to server, warna demo mode) ----------
  var DEMO = 'aag_demo';
  function demoGet() { try { return JSON.parse(localStorage.getItem(DEMO)) || { starts: {}, codes: {} }; } catch (e) { return { starts: {}, codes: {} }; } }
  function demoSet(d) { try { localStorage.setItem(DEMO, JSON.stringify(d)); } catch (e) {} }
  function who() { var u = store.get(); return u ? { name: u.name, edition: u.edition } : null; }
  var NET_ERR = { ok: false, error: 'Could not reach the server. Please try again.' };
  var rewards = {
    start: function (linkId) {
      try {
        sessionStorage.setItem('aag_last_link', linkId);
        localStorage.setItem('aag_last_link', linkId);
      } catch (e) {}
      var w = who(); if (!w) return Promise.resolve({ ok: false, error: 'Please log in first.' });
      if (CFG.apiUrl) {
        return api('/api/link/start', { name: w.name, edition: w.edition, linkId: linkId }, 10000).then(function (r) {
          if (r && r.sessionToken) {
            try {
              sessionStorage.setItem('aag_session_token', r.sessionToken);
              localStorage.setItem('aag_session_token', r.sessionToken);
            } catch (e) {}
          }
          return r || NET_ERR;
        });
      }
      var d = demoGet(); d.starts[linkId] = Date.now(); demoSet(d); return Promise.resolve({ ok: true, demo: true });
    },
    claim: function (linkId, sessionToken) {
      var w = who(); if (!w) return Promise.resolve({ ok: false, error: 'Please log in first.' });
      var s = sessionToken || sessionStorage.getItem('aag_session_token') || localStorage.getItem('aag_session_token') || '';
      if (CFG.apiUrl) return api('/api/code/claim', { name: w.name, edition: w.edition, linkId: linkId, sessionToken: s }, 10000).then(function (r) { return r || NET_ERR; });
      var d = demoGet(), st = d.starts[linkId];
      if (!st) return Promise.resolve({ ok: false, error: 'Please start from the Code Link on the Free Redeem Codes page first.' });
      var wait = st + 3000 - Date.now();
      if (wait > 0) return Promise.resolve({ ok: false, error: 'Please wait...', waitSeconds: Math.ceil(wait / 1000) });
      var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = '';
      for (var i = 0; i < 8; i++) c += A[Math.floor(Math.random() * A.length)];
      c = 'AAG-' + c.slice(0, 4) + '-' + c.slice(4);
      d.codes[c] = { linkId: linkId, used: false }; delete d.starts[linkId]; demoSet(d);
      return Promise.resolve({ ok: true, code: c, demo: true });
    },
    redeem: function (code) {
      var w = who(); if (!w) return Promise.resolve({ ok: false, error: 'Please log in first.' });
      code = String(code || '').trim().toUpperCase();
      if (CFG.apiUrl) return api('/api/redeem', { name: w.name, edition: w.edition, code: code }, 6000).then(function (r) { return r || NET_ERR; });
      var d = demoGet(), c = d.codes[code];
      if (!c) return Promise.resolve({ ok: false, error: 'Invalid code.' });
      if (c.used) return Promise.resolve({ ok: false, error: 'This code was already used.' });
      c.used = true; demoSet(d);
      return Promise.resolve({ ok: true, demo: true, reward: { label: 'Demo reward (connect your server to give real rewards)' } });
    }
  };

  window.AAG = {
    getUser: store.get,
    logout: function () {
      var u = store.get();
      if (u) {
        try { api('/api/afk/release', { name: u.name, edition: u.edition }); } catch (e) {}
      }
      store.clear();
      try {
        localStorage.removeItem('aag_last_link');
        sessionStorage.removeItem('aag_last_link');
        localStorage.removeItem('aag_session_token');
        sessionStorage.removeItem('aag_session_token');
      } catch (e) {}
    },
    validate: validate,
    login: login,
    api: api,
    rewards: rewards,
    safeNext: safeNext,
    requireLogin: function () {
      if (!store.get()) location.replace('login?next=' + encodeURIComponent(currentFile()));
    }
  };

  if (!/(^|\/)login(\.html)?$/.test(location.pathname)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountWidget);
    else mountWidget();
  }
})();
