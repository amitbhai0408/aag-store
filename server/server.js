const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const DATA_DIR = path.join(__dirname, 'data');
const ROOT_DIR = path.resolve(__dirname, '..');
const STORE_DIR = path.join(ROOT_DIR, 'store.aagmc.fun');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website.aagmc.fun');
const RECEIPTS_DIR = path.join(STORE_DIR, 'receipts');
try { fs.mkdirSync(RECEIPTS_DIR, { recursive: true }); } catch (e) {}

// Read config dynamically
function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (e) {
    return { claimMinSeconds: 5, codeTtlMinutes: 1440, links: {} };
  }
}
function getLinks() {
  return getConfig().links || {};
}
let CONFIG = getConfig();
const ADMIN_KEY = process.env.ADMIN_KEY || CONFIG.adminKey || 'aag_admin_key_2026';
const CLAIM_MIN_MS = (CONFIG.claimMinSeconds ?? 5) * 1000;
const CODE_TTL_MS = (CONFIG.codeTtlMinutes ?? 1440) * 60 * 1000;

const NAME_RE = { java: /^[A-Za-z0-9_]{3,16}$/, bedrock: /^\.?[A-Za-z0-9_ ]{1,16}$/ };
const MIN_AFK_GAP_MS = 55 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---- JSON database helper ----
function makeDb(file) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = {}; }
  let saving = false, dirty = false;
  function save() {
    dirty = true;
    if (saving) return;
    saving = true; dirty = false;
    const tmp = file + '.tmp';
    fs.writeFile(tmp, JSON.stringify(data, null, 2), (err) => {
      if (!err) fs.rename(tmp, file, () => { saving = false; if (dirty) save(); });
      else { saving = false; console.error('save failed', err.message); }
    });
  }
  return { data, save };
}
const usersDb = makeDb(path.join(DATA_DIR, 'users.json'));
const codesDb = makeDb(path.join(DATA_DIR, 'codes.json'));
const utrsDb = makeDb(path.join(DATA_DIR, 'utrs.json'));
const ordersDb = makeDb(path.join(DATA_DIR, 'orders.json'));
const users = usersDb.data, codes = codesDb.data, utrs = utrsDb.data, orders = ordersDb.data;

const DEFAULT_PACKAGES = {
  '7446855': { id: '7446855', name: '400 Shards', price: 29, label: '400 Shards', commands: ['addshards {player} 400'] },
  '7446857': { id: '7446857', name: '2,500 Shards', price: 99, label: '2,500 Shards', commands: ['addshards {player} 2500'] },
  '7446858': { id: '7446858', name: '5,500 Shards', price: 199, label: '5,500 Shards', commands: ['addshards {player} 5500'] },
  '7446861': { id: '7446861', name: '12,000 Shards', price: 399, label: '12,000 Shards', commands: ['addshards {player} 12000'] },
  '7446862': { id: '7446862', name: '32,000 Shards', price: 999, label: '32,000 Shards', commands: ['addshards {player} 32000'] },
  '7446865': { id: '7446865', name: '70,000 Shards', price: 1999, label: '70,000 Shards', commands: ['addshards {player} 70000'] },
  '5999412': { id: '5999412', name: 'VIP Rank', price: 99, label: 'VIP Rank (30 Days)', commands: ['lp user {player} parent addtemp vip 30d accumulate', 'addshards {player} 500'] },
  '7446586': { id: '7446586', name: 'MVP Rank', price: 199, label: 'MVP Rank (30 Days)', commands: ['lp user {player} parent addtemp mvp 30d accumulate', 'addshards {player} 1500'] },
  '7706179': { id: '7706179', name: 'ELITE Rank', price: 499, label: 'ELITE Rank (30 Days)', commands: ['lp user {player} parent addtemp elite 30d accumulate', 'addshards {player} 5000'] },
  '810000': { id: '810000', name: 'Common Crate Key', price: 9, label: '1x Common Crate Key', commands: ['crate key {player} common 1'] },
  '810001': { id: '810001', name: 'Prime Crate Key', price: 19, label: '1x Prime Crate Key', commands: ['crate key {player} prime 1'] },
  '810002': { id: '810002', name: 'Crimson Crate Key', price: 39, label: '1x Crimson Crate Key', commands: ['crate key {player} crimson 1'] },
  '810003': { id: '810003', name: 'Gold Crate Key', price: 69, label: '1x Gold Crate Key', commands: ['crate key {player} gold 1'] },
  '810004': { id: '810004', name: 'All 4 Keys Mega Pack', price: 119, label: '1x Common + 1x Prime + 1x Crimson + 1x Gold Key', commands: ['crate key {player} common 1', 'crate key {player} prime 1', 'crate key {player} crimson 1', 'crate key {player} gold 1'] }
};

function sendDiscordWebhook(order) {
  const webhookUrl = (CONFIG.upi && CONFIG.upi.discordWebhook) || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith('http')) return;
  try {
    const parsed = new URL(webhookUrl);
    const baseUrl = (CONFIG.shrinkme && CONFIG.shrinkme.publicBaseUrl) || 'http://localhost:3000';
    const approveUrl = `${baseUrl}/api/pay/action?orderId=${order.id}&token=${order.token}&action=approve`;
    const rejectUrl = `${baseUrl}/api/pay/action?orderId=${order.id}&token=${order.token}&action=reject`;

    const embedObj = {
      title: '🛒 New Store Order Submitted!',
      description: `Player **${order.player}** has submitted a payment of **₹${order.price}** via UPI.\nPlease verify FamPay receipt and click an action below:\n\n👉 **[✅ Approve & Deliver In-Game](${approveUrl})**\n👉 **[❌ Reject / Fake Payment](${rejectUrl})**`,
      color: 0xFACC15,
      fields: [
        { name: 'Order ID', value: `\`${order.id}\``, inline: true },
        { name: 'Player', value: `\`${order.player}\` (${order.edition})`, inline: true },
        { name: 'Package', value: `${order.packageName}`, inline: true },
        { name: 'Amount Paid', value: `**₹${order.price}**`, inline: true },
        { name: 'Payment Mode', value: order.utrProvided ? `UTR: \`${order.utr}\`` : '⚡ **Direct UPI (FamPay)**', inline: true },
        { name: 'Status', value: '⏳ Awaiting Admin Approval', inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'AAG MC Store • 1-Click Verification' }
    };

    if (order.receiptUrl) {
      embedObj.image = { url: `${baseUrl}${order.receiptUrl}` };
      embedObj.fields.push({
        name: 'Receipt Proof',
        value: `[🖼️ View Screenshot](${baseUrl}${order.receiptUrl})`,
        inline: false
      });
    }

    const body = JSON.stringify({
      username: 'AAG SMP Store',
      avatar_url: 'https://store.aagmc.fun/favicon.ico',
      embeds: [embedObj]
    });

    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? require('https') : require('http');
    const wReq = client.request(parsed, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    });
    wReq.on('error', (err) => console.error('[Discord Webhook Error]', err.message));
    wReq.write(body);
    wReq.end();
  } catch (e) {
    console.error('[Discord Webhook Exception]', e.message);
  }
}

// ---- Rate limit: 120 req / min per IP ----
const hits = new Map();
function limited(ip) {
  const now = Date.now(), e = hits.get(ip) || { n: 0, t: now };
  if (now - e.t > 60000) { e.n = 0; e.t = now; }
  e.n++; hits.set(ip, e);
  return e.n > 120;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > 120000) hits.delete(k); }, 120000).unref();

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Vary': 'Origin'
  });
  res.end(JSON.stringify(obj));
}

function readBody(req, maxLimit = 10485760) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > maxLimit) { reject(new Error('Payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data || !data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        // Try loose JSON or return 400
        try {
          // If keys are unquoted like {name:ArupMC}
          const fixed = data.replace(/([{\s,])(\w+)\s*:/g, '$1"$2":');
          resolve(JSON.parse(fixed));
        } catch (e2) {
          reject(new Error('Invalid JSON: ' + e.message));
        }
      }
    });
    req.on('error', reject);
  });
}

function parseUser(b) {
  if (!b) return null;
  const edition = b.edition === 'bedrock' ? 'bedrock' : 'java';
  let name = typeof b.name === 'string' ? b.name.trim() : '';
  if (edition === 'bedrock') {
    // Strip leading dots if user typed them: allows "Amit" or ".Amit"
    const clean = name.replace(/^\.+/, '').trim();
    if (!clean || clean.length < 1 || clean.length > 16 || !/^[A-Za-z0-9_ ]+$/.test(clean)) {
      return null;
    }
    const inGameName = '.' + clean;
    const id = 'bedrock:' + clean.toLowerCase();
    return { edition: 'bedrock', name: clean, inGameName, id };
  } else {
    if (!NAME_RE.java.test(name)) return null;
    return { edition: 'java', name, inGameName: name, id: 'java:' + name.toLowerCase() };
  }
}

// Session Finder: Resolves active link session across editions & tokens
function findSession(p, sToken, linkId) {
  if (!p) return null;
  const username = (p.name || '').toLowerCase();
  const now = Date.now();
  const maxAge = 45 * 60 * 1000; // 45 minutes

  // 1. Direct lookup in current user's sessions by sToken
  const currentU = users[p.id];
  if (currentU && currentU.sessions && sToken && currentU.sessions[sToken]) {
    const s = currentU.sessions[sToken];
    if (now - s.startedAt <= maxAge) {
      return { session: s, user: currentU, sToken };
    }
  }

  // 2. Lookup across all accounts matching same username (e.g. java vs bedrock)
  for (const ed of ['java', 'bedrock']) {
    const candidateU = users[`${ed}:${username}`];
    if (candidateU && candidateU.sessions) {
      if (sToken && candidateU.sessions[sToken]) {
        const s = candidateU.sessions[sToken];
        if (now - s.startedAt <= maxAge) {
          return { session: s, user: candidateU, sToken };
        }
      }
    }
  }

  // 3. Lookup across ALL users in database by sToken
  if (sToken) {
    for (const [uid, userObj] of Object.entries(users)) {
      if (userObj && userObj.sessions && userObj.sessions[sToken]) {
        const s = userObj.sessions[sToken];
        if (now - s.startedAt <= maxAge) {
          return { session: s, user: userObj, sToken };
        }
      }
    }
  }

  // 4. Fallback: If sToken was stripped by shortener or lost in transit, check for recent active session for this user
  for (const ed of [p.edition, p.edition === 'bedrock' ? 'java' : 'bedrock']) {
    const candidateU = users[`${ed}:${username}`];
    if (candidateU && candidateU.sessions) {
      let bestToken = null;
      let bestSession = null;
      for (const [t, s] of Object.entries(candidateU.sessions)) {
        if (!linkId || s.linkId === linkId) {
          if (now - s.startedAt <= maxAge) {
            if (!bestSession || s.startedAt > bestSession.startedAt) {
              bestSession = s;
              bestToken = t;
            }
          }
        }
      }
      if (bestSession) {
        return { session: bestSession, user: candidateU, sToken: bestToken };
      }
    }
  }

  return null;
}

function isAdmin(req, url) {
  const k = req.headers['x-admin-key'] || url.searchParams.get('key');
  return !!ADMIN_KEY && k === ADMIN_KEY;
}

function newCode() {
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return 'AAG-' + s.slice(0, 4) + '-' + s.slice(4);
}

// AroLinks Dynamic URL Shortening Helper (Link 1 & Link 2 - 2 Pages Easy)
async function shortenWithArolinks(destUrl, cfg) {
  const aroCfg = (cfg || getConfig()).arolinks || {};
  if (aroCfg.enabled && aroCfg.apiToken) {
    try {
      const apiEndpoint = `https://arolinks.com/api?api=${encodeURIComponent(aroCfg.apiToken)}&url=${encodeURIComponent(destUrl)}`;
      const res = await fetch(apiEndpoint).then(r => r.json());
      if (res && res.status === 'success' && res.shortenedUrl) {
        return res.shortenedUrl;
      }
      console.warn('AroLinks API did not return success:', res);
    } catch (e) {
      console.error('AroLinks API call failed:', e.message);
    }
  }
  return null;
}

// VPLink Dynamic URL Shortening Helper (Link 3 & Link 4 - $10 CPM Hardcore)
async function shortenWithVplink(destUrl, cfg) {
  const vpCfg = (cfg || getConfig()).vplink || {};
  if (vpCfg.enabled && vpCfg.apiToken) {
    try {
      const apiEndpoint = `https://vplink.in/api?api=${encodeURIComponent(vpCfg.apiToken)}&url=${encodeURIComponent(destUrl)}`;
      const res = await fetch(apiEndpoint).then(r => r.json());
      if (res && res.status === 'success' && res.shortenedUrl) {
        return res.shortenedUrl;
      }
      console.warn('VPLink API did not return success:', res);
    } catch (e) {
      console.error('VPLink API call failed:', e.message);
    }
  }
  return null;
}

// GPLinks & ShrinkMe Dynamic URL Shortening Helper
async function shortenWithGplinks(destUrl, cfg) {
  const gpCfg = (cfg || getConfig()).gplinks || {};
  if (gpCfg.enabled && gpCfg.apiToken) {
    try {
      const apiEndpoint = `https://api.gplinks.com/api?api=${encodeURIComponent(gpCfg.apiToken)}&url=${encodeURIComponent(destUrl)}`;
      const res = await fetch(apiEndpoint).then(r => r.json());
      if (res && res.status === 'success' && res.shortenedUrl) {
        return res.shortenedUrl;
      }
      console.warn('GPLinks API did not return success:', res);
    } catch (e) {
      console.error('GPLinks API call failed:', e.message);
    }
  }
  return null;
}

async function shortenWithShrinkme(destUrl, cfg) {
  const shrinkCfg = (cfg || getConfig()).shrinkme || {};
  if (shrinkCfg.enabled && shrinkCfg.apiToken) {
    try {
      const apiEndpoint = `https://shrinkme.io/api?api=${encodeURIComponent(shrinkCfg.apiToken)}&url=${encodeURIComponent(destUrl)}`;
      const res = await fetch(apiEndpoint).then(r => r.json());
      if (res && res.status === 'success' && res.shortenedUrl) {
        return res.shortenedUrl;
      }
      console.warn('Shrinkme API did not return success:', res);
    } catch (e) {
      console.error('Shrinkme API call failed:', e.message);
    }
  }
  return null;
}

// Linkvertise Dynamic URL Generator (Global Gaming Standard)
function shortenWithLinkvertise(destUrl, cfg) {
  const lvCfg = (cfg || getConfig()).linkvertise || {};
  if (lvCfg.enabled && lvCfg.userId) {
    try {
      const b64 = Buffer.from(destUrl).toString('base64');
      const rand = Math.floor(Math.random() * 1000) + 1;
      return `https://link-to.net/${lvCfg.userId}/${rand}/dynamic?r=${b64}`;
    } catch (e) {
      console.error('Linkvertise generation failed:', e.message);
    }
  }
  return null;
}

// Smart routing: Linkvertise preferred
async function shortenUrl(destUrl, linkId, cfg) {
  const c = cfg || getConfig();
  const linkCfg = (c.links && linkId && c.links[linkId]) || {};
  const preferred = linkCfg.provider || 'linkvertise';

  if (preferred === 'linkvertise' || (c.linkvertise && c.linkvertise.enabled)) {
    const s = shortenWithLinkvertise(destUrl, c);
    if (s) return s;
  }

  if (preferred === 'arolinks' && c.arolinks && c.arolinks.enabled) {
    const s = await shortenWithArolinks(destUrl, c);
    if (s) return s;
  }
  if (preferred === 'vplink' && c.vplink && c.vplink.enabled) {
    const s = await shortenWithVplink(destUrl, c);
    if (s) return s;
  }
  if (c.gplinks && c.gplinks.enabled && c.gplinks.apiToken) {
    const s = await shortenWithGplinks(destUrl, c);
    if (s) return s;
  }
  return null;
}

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=UTF-8'
};

function serveStatic(req, res, pathname) {
  let reqPath = decodeURIComponent(pathname);

  // Clean URLs: 301 Redirect /page.html to /page (except verification files)
  if (reqPath.endsWith('.html') && !/^\/[a-f0-9]{32}\.html$/i.test(reqPath)) {
    let cleanPath = reqPath.slice(0, -5);
    if (cleanPath === '/index' || cleanPath === '') cleanPath = '/';
    const qIdx = (req.url || '').indexOf('?');
    const search = qIdx !== -1 ? req.url.slice(qIdx) : '';
    res.writeHead(301, {
      'Location': cleanPath + search,
      'Access-Control-Allow-Origin': '*'
    });
    res.end();
    return true;
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  function findCandidate(baseDir, p) {
    if (!baseDir) return null;
    // 1. Exact file match
    const cand = path.normalize(path.join(baseDir, p));
    if (cand.startsWith(baseDir) && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return cand;
    }
    // 2. Clean URL match: append .html (e.g. /store -> /store.html)
    const candHtml = path.normalize(path.join(baseDir, p + '.html'));
    if (candHtml.startsWith(baseDir) && fs.existsSync(candHtml) && fs.statSync(candHtml).isFile()) {
      return candHtml;
    }
    // 3. Directory index
    const candIndex = path.normalize(path.join(baseDir, p, 'index.html'));
    if (candIndex.startsWith(baseDir) && fs.existsSync(candIndex) && fs.statSync(candIndex).isFile()) {
      return candIndex;
    }
    return null;
  }

  const filePath = findCandidate(STORE_DIR, reqPath) ||
                   findCandidate(ROOT_DIR, reqPath) ||
                   findCandidate(WEBSITE_DIR, reqPath);

  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isMediaAsset = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'].includes(ext);
    const cacheControl = isMediaAsset
      ? 'public, max-age=86400'
      : 'no-cache, no-store, must-revalidate';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheControl
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
    return true;
  }

  return false;
}

function getClientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf && typeof cf === 'string') return cf.split(',')[0].trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') return xff.split(',')[0].trim();
  const xReal = req.headers['x-real-ip'];
  if (xReal && typeof xReal === 'string') return xReal.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

// AFK Concurrency Locks: 1 Account per IP, 1 Tab per Account
const afkIpLocks = new Map();   // Map<clientIp, { userId: string, tabId: string, lastPingAt: number, playerName: string }>
const afkUserLocks = new Map(); // Map<userId, { tabId: string, clientIp: string, lastPingAt: number }>
const AFK_LOCK_EXPIRY_MS = 90 * 1000; // 90 seconds timeout without heartbeat

function cleanAfkLocks(now) {
  for (const [ip, l] of afkIpLocks.entries()) {
    if (now - l.lastPingAt > AFK_LOCK_EXPIRY_MS) afkIpLocks.delete(ip);
  }
  for (const [uid, l] of afkUserLocks.entries()) {
    if (now - l.lastPingAt > AFK_LOCK_EXPIRY_MS) afkUserLocks.delete(uid);
  }
}

const server = http.createServer(async (req, res) => {
  const ip = getClientIp(req);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (limited(ip)) return send(res, 429, { ok: false, error: 'Too many requests, please slow down.' });
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost:3000'));

  try {
    // ==========================================
    // API ROUTES
    // ==========================================
    if (url.pathname.startsWith('/api/')) {

      // ---------- Health & Status ----------
      if (req.method === 'GET' && url.pathname === '/api/status') {
        return send(res, 200, {
          ok: true,
          service: 'aag-smp-api',
          usersCount: Object.keys(users).length,
          codesCount: Object.keys(codes).length,
          time: new Date().toISOString()
        });
      }

      // ---------- Get Public Links Configuration ----------
      if (req.method === 'GET' && url.pathname === '/api/links') {
        const cfg = getConfig();
        if (cfg.linksMaintenance) {
          return send(res, 200, {
            ok: true,
            maintenance: true,
            message: 'Free Redeem Code links are currently under maintenance for system upgrades.',
            links: []
          });
        }
        const liveLinks = cfg.links || {};
        const qName = url.searchParams.get('name');
        const qEdition = url.searchParams.get('edition');
        let userRecord = null;
        if (qName) {
          const p = parseUser({ name: qName, edition: qEdition });
          if (p && users[p.id]) userRecord = users[p.id];
        }

        const now = Date.now();
        const publicLinks = Object.keys(liveLinks).map((id, index) => {
          const l = liveLinks[id];
          const steps = l.steps || (index + 1);
          const stepText = steps === 1 ? '1 Step' : (steps + ' Steps');
          const rewardLabel = (l.reward && l.reward.label) ? l.reward.label : 'Free Reward';
          const cdMs = (l.cooldownMinutes || 60) * 60000;
          const lastClaim = (userRecord && userRecord.lastClaim && userRecord.lastClaim[id]) || 0;
          const cdLeft = Math.max(0, lastClaim + cdMs - now);
          const onCooldown = cdLeft > 0;

          return {
            id: id,
            title: l.title || ('Code Link ' + (index + 1)),
            desc: 'Reward: ' + rewardLabel + ' \u00b7 ' + stepText,
            steps: steps,
            rewardLabel: rewardLabel,
            url: l.shortenerUrl && l.shortenerUrl.trim() ? l.shortenerUrl.trim() : ('claim.html?l=' + id),
            cooldownMinutes: l.cooldownMinutes || 60,
            onCooldown: onCooldown,
            cooldownLeftSeconds: Math.ceil(cdLeft / 1000),
            cooldownLeftMinutes: Math.ceil(cdLeft / 60000)
          };
        });
        return send(res, 200, { ok: true, links: publicLinks });
      }

      // ---------- Login ----------
      if (req.method === 'POST' && url.pathname === '/api/login') {
        const p = parseUser(await readBody(req));
        if (!p) return send(res, 400, { ok: false, error: 'Invalid username format.' });
        const now = new Date().toISOString();

        // Bedrock backwards-compatibility: merge legacy dotted key if present
        if (p.edition === 'bedrock' && !users[p.id] && users['bedrock:.' + p.name.toLowerCase()]) {
          users[p.id] = users['bedrock:.' + p.name.toLowerCase()];
          delete users['bedrock:.' + p.name.toLowerCase()];
        }

        const u = users[p.id] || (users[p.id] = {
          name: p.name,
          edition: p.edition,
          firstLogin: now,
          logins: 0,
          afkMinutes: 0,
          lastAfkAt: 0,
          pending: [],
          redeemedCount: 0
        });
        u.name = p.name;
        u.edition = p.edition;
        u.logins++;
        u.lastLogin = now;
        usersDb.save();
        return send(res, 200, { ok: true, user: { name: u.name, edition: u.edition, afkMinutes: u.afkMinutes } });
      }

      // ---------- AFK: Client IP & Status Info ----------
      if (req.method === 'GET' && url.pathname === '/api/afk/client-info') {
        const clientIp = getClientIp(req);
        return send(res, 200, { ok: true, clientIp: clientIp });
      }

      // ---------- AFK: Release IP Lock on Logout / Change ----------
      if (req.method === 'POST' && url.pathname === '/api/afk/release') {
        const clientIp = getClientIp(req);
        if (clientIp) afkIpLocks.delete(clientIp);
        const body = await readBody(req);
        const p = parseUser(body);
        if (p && afkUserLocks.has(p.id)) afkUserLocks.delete(p.id);
        return send(res, 200, { ok: true });
      }

      // ---------- AFK: Register Tab & Heartbeat (1 IP = 1 Account, 1 Tab = 1 Session) ----------
      if (req.method === 'POST' && (url.pathname === '/api/afk/register' || url.pathname === '/api/afk/heartbeat')) {
        const body = await readBody(req);
        const p = parseUser(body);
        const u = p && users[p.id];
        if (!u) return send(res, 404, { ok: false, error: 'Please log in first.' });

        const now = Date.now();
        cleanAfkLocks(now);
        const clientIp = getClientIp(req);
        const tabId = String(body.tabId || 'default').trim();
        const force = !!body.force;

        // 1. IP Check: Is this IP already active with a DIFFERENT user account?
        const ipLock = afkIpLocks.get(clientIp);
        if (ipLock && ipLock.userId !== p.id && (now - ipLock.lastPingAt < AFK_LOCK_EXPIRY_MS)) {
          if (!force) {
            return send(res, 403, {
              ok: false,
              code: 'IP_LOCKED',
              currentHolder: ipLock.playerName,
              error: `Another account ('${ipLock.playerName}') is already active in the AFK Zone on your network. Only 1 account per IP is allowed at a time.`
            });
          }
          // Force takeover: Release old account and assign lock to this new account
          afkIpLocks.delete(clientIp);
          afkUserLocks.delete(ipLock.userId);
        }

        // 2. User Check: Is this user already active in another tab?
        const userLock = afkUserLocks.get(p.id);
        if (userLock && userLock.tabId !== tabId && (now - userLock.lastPingAt < 35 * 1000)) {
          if (!force) {
            return send(res, 409, {
              ok: false,
              code: 'TAB_CONFLICT',
              clientIp: clientIp,
              error: 'AFK Zone is already active in another tab. Only 1 active tab is allowed at a time!'
            });
          }
        }

        // Acquire or refresh lock
        afkIpLocks.set(clientIp, { userId: p.id, tabId: tabId, lastPingAt: now, playerName: p.name });
        afkUserLocks.set(p.id, { tabId: tabId, clientIp: clientIp, lastPingAt: now });

        return send(res, 200, {
          ok: true,
          clientIp: clientIp,
          activeTabId: tabId,
          afkMinutes: u.afkMinutes || 0
        });
      }

      // ---------- AFK Minute Tracker & Reward Queue (Strict IP & Tab Check) ----------
      if (req.method === 'POST' && url.pathname === '/api/afk') {
        const body = await readBody(req);
        const p = parseUser(body);
        const u = p && users[p.id];
        if (!u) return send(res, 404, { ok: false, error: 'Please log in first.' });

        const now = Date.now();
        cleanAfkLocks(now);
        const clientIp = getClientIp(req);
        const tabId = String(body.tabId || 'default').trim();

        // 1. Strict IP Concurrency Lock: Cannot claim if IP belongs to someone else
        const ipLock = afkIpLocks.get(clientIp);
        if (ipLock && ipLock.userId !== p.id && (now - ipLock.lastPingAt < AFK_LOCK_EXPIRY_MS)) {
          return send(res, 403, {
            ok: false,
            code: 'IP_LOCKED',
            error: `Another account ('${ipLock.playerName}') is already active on your network. Multiple accounts on a single IP are not permitted.`
          });
        }

        // 2. Single Tab Lock: Reject if claiming from an out-of-sync tab
        const userLock = afkUserLocks.get(p.id);
        if (userLock && userLock.tabId && userLock.tabId !== tabId && (now - userLock.lastPingAt < 35 * 1000)) {
          return send(res, 409, {
            ok: false,
            code: 'TAB_CONFLICT',
            clientIp: clientIp,
            error: 'Reward claim blocked: Another tab is active. Rewards can only be earned in a single active tab.'
          });
        }

        // 3. Rate Limit (Min 55 seconds gap)
        if (now - (u.lastAfkAt || 0) < MIN_AFK_GAP_MS) {
          const waitSec = Math.ceil((MIN_AFK_GAP_MS - (now - (u.lastAfkAt || 0))) / 1000);
          return send(res, 429, {
            ok: false,
            code: 'TOO_FAST',
            clientIp: clientIp,
            error: `Too fast! Please wait ${waitSec}s.`,
            afkMinutes: u.afkMinutes
          });
        }

        u.afkMinutes = (u.afkMinutes || 0) + 1;
        u.lastAfkAt = now;
        u.lastSeen = new Date().toISOString();

        // Refresh locks
        afkIpLocks.set(clientIp, { userId: p.id, tabId: tabId, lastPingAt: now, playerName: p.name });
        afkUserLocks.set(p.id, { tabId: tabId, clientIp: clientIp, lastPingAt: now });

        // Queue in-game reward for AFK
        const afkCfg = getConfig().afk || { enabled: true, rewardLabel: '1x AFK Shard' };
        if (afkCfg.enabled) {
          const inGamePlayer = (u.edition === 'bedrock' && !u.name.startsWith('.')) ? ('.' + u.name) : u.name;
          const cmd = (afkCfg.rewardCommand ? afkCfg.rewardCommand : "addshards {player} 1").replace(/\{player\}/g, inGamePlayer);
          (u.pending = u.pending || []).push({
            id: crypto.randomBytes(6).toString('hex'),
            type: 'afk',
            code: 'AFK-REWARD',
            linkId: 'afk',
            reward: {
              label: afkCfg.rewardLabel || '1x AFK Shard',
              commands: [cmd]
            },
            at: new Date().toISOString()
          });
        }

        usersDb.save();
        console.log(`[AFK REWARD DELIVERED] User: ${u.name} (${u.edition}), IP: ${clientIp}, Total AFK Mins: ${u.afkMinutes}`);
        return send(res, 200, { ok: true, afkMinutes: u.afkMinutes, clientIp: clientIp });
      }

      // ---------- Code Link: Start (Generates Unique ShrinkMe Link & One-Time Token) ----------
      if (req.method === 'POST' && url.pathname === '/api/link/start') {
        const cfg = getConfig();
        if (cfg.linksMaintenance) {
          return send(res, 503, {
            ok: false,
            error: 'Free Redeem Code links are currently under maintenance for system upgrades. Please check back soon!'
          });
        }
        const b = await readBody(req);
        const p = parseUser(b);
        const u = p && users[p.id];
        if (!u) return send(res, 404, { ok: false, error: 'Please log in first.' });

        const liveLinks = cfg.links || {};
        const link = liveLinks[b.linkId];
        if (!link) return send(res, 404, { ok: false, error: 'Unknown link ID.' });

        const left = ((u.lastClaim && u.lastClaim[b.linkId]) || 0) + (link.cooldownMinutes || 60) * 60000 - Date.now();
        if (left > 0) {
          const mins = Math.ceil(left / 60000);
          return send(res, 429, {
            ok: false,
            error: 'This link is on cooldown. Try again in ' + mins + ' min.',
            onCooldown: true,
            cooldownLeftMinutes: mins,
            cooldownLeftSeconds: Math.ceil(left / 1000)
          });
        }

        // Generate a random one-time session token
        const sessionToken = 'st_' + crypto.randomBytes(16).toString('hex');
        u.sessions = u.sessions || {};

        // Clean up old sessions (> 2 hours)
        const now = Date.now();
        for (const [k, v] of Object.entries(u.sessions)) {
          if (now - (v.startedAt || 0) > 2 * 3600 * 1000) delete u.sessions[k];
        }

        const totalSteps = link.steps || 1;
        u.sessions[sessionToken] = {
          linkId: b.linkId,
          totalSteps: totalSteps,
          currentStep: 1,
          stepsCompleted: 0,
          startedAt: now,
          stepStartedAt: now
        };
        usersDb.save();

        const publicBase = ((cfg.gplinks && cfg.gplinks.publicBaseUrl) || (cfg.shrinkme && cfg.shrinkme.publicBaseUrl) || 'https://store.aagmc.fun').replace(/\/+$/, '');

        let destUrl;
        if (totalSteps > 1) {
          destUrl = `${publicBase}/step.html?s=${sessionToken}&step=1`;
        } else {
          destUrl = `${publicBase}/claim.html?s=${sessionToken}&l=${b.linkId}`;
        }

        let shortUrl = await shortenUrl(destUrl, b.linkId, cfg);
        if (!shortUrl) {
          shortUrl = link.shortenerUrl && link.shortenerUrl.trim()
            ? link.shortenerUrl.trim()
            : destUrl;
        }

        const monetagCfg = cfg.monetag || {};
        const directLink = (monetagCfg.enabled && monetagCfg.directLink)
          ? monetagCfg.directLink
          : ((cfg.adsterra && cfg.adsterra.directLink) ? cfg.adsterra.directLink : '');

        return send(res, 200, { ok: true, sessionToken, shortUrl, destUrl, directLink, totalSteps });
      }

      // ---------- Code Link: Step Verify (Multi-Step progression) ----------
      if (req.method === 'POST' && url.pathname === '/api/link/step-verify') {
        const b = await readBody(req);
        const p = parseUser(b);
        const u = p && users[p.id];
        if (!u) return send(res, 404, { ok: false, error: 'Please log in first.' });

        const sToken = b.sessionToken;
        const found = findSession(p, sToken, b.linkId);

        if (!found || !found.session) {
          return send(res, 403, {
            ok: false,
            error: 'Session expired or invalid. Please start again from the Free Redeem Codes page.'
          });
        }

        const session = found.session;
        const sessionOwner = found.user;
        const activeToken = found.sToken;

        const cfg = getConfig();
        const liveLinks = cfg.links || {};
        const link = liveLinks[session.linkId] || {};
        const totalSteps = session.totalSteps || link.steps || 1;
        const reqStep = parseInt(b.step || '1', 10);

        const now = Date.now();
        const stepStart = session.stepStartedAt || session.startedAt || now;
        const elapsed = now - stepStart;
        const minWaitMs = (cfg.claimMinSeconds ?? 5) * 1000;

        // If this step is not yet marked complete, enforce minimum wait
        if ((session.stepsCompleted || 0) < reqStep && elapsed < minWaitMs) {
          return send(res, 425, {
            ok: false,
            error: 'Please finish all steps on the ad page...',
            waitSeconds: Math.ceil((minWaitMs - elapsed) / 1000)
          });
        }

        // Mark this step completed
        session.stepsCompleted = Math.max(session.stepsCompleted || 0, reqStep);

        const nextStep = reqStep + 1;
        const publicBase = ((cfg.gplinks && cfg.gplinks.publicBaseUrl) || (cfg.shrinkme && cfg.shrinkme.publicBaseUrl) || 'https://store.aagmc.fun').replace(/\/+$/, '');

        let nextDestUrl;
        if (nextStep >= totalSteps) {
          // Final step leads to claim.html
          nextDestUrl = `${publicBase}/claim.html?s=${activeToken}&l=${session.linkId}`;
        } else {
          // Intermediate step leads to step.html for nextStep
          nextDestUrl = `${publicBase}/step.html?s=${activeToken}&step=${nextStep}`;
        }

        let nextShortUrl = await shortenUrl(nextDestUrl, session.linkId, cfg);
        if (!nextShortUrl) {
          nextShortUrl = nextDestUrl;
        }

        const monetagCfg = cfg.monetag || {};
        const directLink = (monetagCfg.enabled && monetagCfg.directLink)
          ? monetagCfg.directLink
          : ((cfg.adsterra && cfg.adsterra.directLink) ? cfg.adsterra.directLink : '');

        session.currentStep = nextStep;
        session.stepStartedAt = Date.now();
        usersDb.save();

        return send(res, 200, {
          ok: true,
          currentStep: reqStep,
          nextStep: nextStep,
          totalSteps: totalSteps,
          nextShortUrl: nextShortUrl,
          nextDestUrl: nextDestUrl,
          directLink: directLink,
          rewardLabel: (link.reward && link.reward.label) || 'Reward'
        });
      }

      // ---------- Code Link: Claim after completing link (Strict Anti-Bypass) ----------
      if (req.method === 'POST' && url.pathname === '/api/code/claim') {
        const b = await readBody(req);
        const p = parseUser(b);
        const u = p && users[p.id];
        if (!u) return send(res, 404, { ok: false, error: 'Please log in first.' });

        const cfg = getConfig();
        const liveLinks = cfg.links || {};
        const sToken = b.sessionToken;

        const found = findSession(p, sToken, b.linkId);

        // ANTI-BYPASS CHECK 1: Must have a valid, active session token
        if (!found || !found.session) {
          return send(res, 403, {
            ok: false,
            error: '❌ Session expired or invalid. Please click "Get Code" on the Free Redeem Codes page.'
          });
        }

        const session = found.session;
        const sessionOwner = found.user;
        const activeToken = found.sToken;

        const linkId = session.linkId || b.linkId || 'link1';
        const link = liveLinks[linkId] || { cooldownMinutes: 60 };
        const totalSteps = session.totalSteps || link.steps || 1;

        // ANTI-BYPASS CHECK 2: All intermediate steps must have been verified
        if (totalSteps > 1 && (session.stepsCompleted || 0) < totalSteps - 1) {
          return send(res, 403, {
            ok: false,
            error: '❌ Bypass Detected! You have not completed all intermediate ad steps. Completed: ' + (session.stepsCompleted || 0) + '/' + totalSteps
          });
        }

        // ANTI-BYPASS CHECK 3: Minimum time check on final step
        const stepStart = session.stepStartedAt || session.startedAt;
        const elapsed = Date.now() - stepStart;
        const minWaitMs = (cfg.claimMinSeconds ?? 5) * 1000;
        if (elapsed < minWaitMs) {
          return send(res, 425, {
            ok: false,
            error: 'Please finish all steps on the ad page...',
            waitSeconds: Math.ceil((minWaitMs - elapsed) / 1000)
          });
        }

        // ANTI-BYPASS CHECK 4: Max time check (session expires after 45 minutes)
        if (Date.now() - session.startedAt > 45 * 60 * 1000) {
          if (sessionOwner && sessionOwner.sessions) delete sessionOwner.sessions[activeToken];
          usersDb.save();
          return send(res, 403, { ok: false, error: 'This session has expired. Please get a fresh link.' });
        }

        // Check Cooldown
        const cd = ((u.lastClaim && u.lastClaim[linkId]) || 0) + (link.cooldownMinutes || 60) * 60000 - Date.now();
        if (cd > 0) {
          return send(res, 429, { ok: false, error: 'This link is on cooldown. Try again in ' + Math.ceil(cd / 60000) + ' min.' });
        }

        // BURN AND DESTROY SESSION TOKEN IMMEDIATELY!
        if (sessionOwner && sessionOwner.sessions) delete sessionOwner.sessions[activeToken];

        // Mark cooldown
        u.lastClaim = u.lastClaim || {};
        u.lastClaim[linkId] = Date.now();

        let code;
        do { code = newCode(); } while (codes[code]);

        codes[code] = {
          userId: p.id,
          playerName: p.name,
          edition: p.edition,
          linkId: linkId,
          createdAt: Date.now(),
          expiresAt: Date.now() + CODE_TTL_MS,
          used: false
        };

        usersDb.save();
        codesDb.save();
        return send(res, 200, { ok: true, code, expiresAt: codes[code].expiresAt });
      }

      // ---------- Web Redeem: User redeems code on website ----------
      if (req.method === 'POST' && url.pathname === '/api/redeem') {
        const b = await readBody(req);
        const p = parseUser(b);
        const u = p && users[p.id];
        if (!u) return send(res, 404, { ok: false, error: 'Please log in first.' });
        const code = String(b.code || '').trim().toUpperCase();
        const c = /^AAG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && codes[code];
        if (!c || (c.userId && c.userId !== p.id)) return send(res, 400, { ok: false, error: 'Invalid code or belongs to another player.' });
        if (c.used) return send(res, 400, { ok: false, error: 'This code was already used.' });
        if (Date.now() > c.expiresAt) return send(res, 400, { ok: false, error: 'This code has expired.' });

        c.used = true;
        c.usedAt = Date.now();
        const link = getLinks()[c.linkId] || {};
        const reward = link.reward || { label: 'Free Reward', commands: ['addshards {player} 5'] };

        (u.pending = u.pending || []).push({
          id: crypto.randomBytes(6).toString('hex'),
          type: 'redeem',
          code: code,
          linkId: c.linkId,
          reward: reward,
          at: new Date().toISOString()
        });
        u.redeemedCount = (u.redeemedCount || 0) + 1;
        usersDb.save();
        codesDb.save();
        return send(res, 200, { ok: true, reward });
      }

      // ---------- In-Game Redeem: Minecraft plugin executes /redeem <code> ----------
      if (req.method === 'POST' && url.pathname === '/api/game-redeem') {
        if (!isAdmin(req, url)) return send(res, 403, { ok: false, error: 'Unauthorized: Invalid Admin Key.' });
        const b = await readBody(req);
        const playerName = String(b.player || '').trim();
        const edition = b.edition === 'bedrock' ? 'bedrock' : 'java';
        const code = String(b.code || '').trim().toUpperCase();

        if (!playerName || !code) {
          return send(res, 400, { ok: false, error: 'Player name and code are required.' });
        }

        const c = /^AAG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && codes[code];
        if (!c) {
          return send(res, 404, { ok: false, error: 'Code not found or invalid.' });
        }
        if (c.used) {
          return send(res, 400, { ok: false, error: 'This code was already used.' });
        }
        if (Date.now() > c.expiresAt) {
          return send(res, 400, { ok: false, error: 'This code has expired.' });
        }

        // Optional: Check if code was created for this player
        if (c.playerName && c.playerName.toLowerCase() !== playerName.toLowerCase()) {
          return send(res, 403, { ok: false, error: 'This code was generated for player ' + c.playerName + '.' });
        }

        c.used = true;
        c.usedAt = Date.now();
        c.usedByInGame = playerName;

        const userId = edition + ':' + playerName.toLowerCase();
        const u = users[userId] || (users[userId] = {
          name: playerName,
          edition: edition,
          firstLogin: new Date().toISOString(),
          logins: 1,
          afkMinutes: 0,
          pending: [],
          redeemedCount: 0
        });
        u.redeemedCount = (u.redeemedCount || 0) + 1;

        const link = getLinks()[c.linkId] || {};
        const reward = link.reward || { label: 'Free Reward', commands: ['addshards {player} 5'] };

        codesDb.save();
        usersDb.save();

        return send(res, 200, {
          ok: true,
          code: code,
          linkId: c.linkId,
          reward: reward
        });
      }

      // ---------- Admin: Get Pending Rewards for Minecraft plugin ----------
      if (req.method === 'GET' && url.pathname === '/api/pending') {
        if (!isAdmin(req, url)) return send(res, 403, { ok: false, error: 'Unauthorized: Invalid Admin Key.' });
        const out = [];
        for (const u of Object.values(users)) {
          for (const r of (u.pending || [])) {
            const clean = (u.name || '').replace(/^\.+/, '');
            const inGameName = (u.edition === 'bedrock') ? ('.' + clean) : u.name;
            const cmds = (r.reward && r.reward.commands) ? r.reward.commands : [];
            out.push({
              id: r.id,
              userId: `${u.edition}:${clean.toLowerCase()}`,
              name: inGameName,
              cleanName: clean,
              edition: u.edition,
              type: r.type || 'reward',
              code: r.code || '',
              reward: r.reward,
              rewardLabel: (r.reward && r.reward.label) ? r.reward.label : 'Store Reward',
              commands: cmds,
              at: r.at
            });
          }
        }
        return send(res, 200, { ok: true, pending: out });
      }

      // ---------- Admin: Mark Delivered Rewards ----------
      if (req.method === 'POST' && url.pathname === '/api/delivered') {
        if (!isAdmin(req, url)) return send(res, 403, { ok: false, error: 'Unauthorized: Invalid Admin Key.' });
        const ids = new Set((await readBody(req)).ids || []);
        let n = 0;
        for (const u of Object.values(users)) {
          const before = (u.pending || []).length;
          u.pending = (u.pending || []).filter((r) => !ids.has(r.id));
          n += before - u.pending.length;
        }
        usersDb.save();
        return send(res, 200, { ok: true, delivered: n });
      }

      // ---------- UPI: Get Payment Config ----------
      if (req.method === 'GET' && url.pathname === '/api/pay/config') {
        const upi = Object.assign({ vpa: '6295282909@fam', name: 'AAG SMP', fampayQrImage: 'images/fampay-qr.jpg' }, CONFIG.upi || {});
        const allPackages = Object.assign({}, DEFAULT_PACKAGES, CONFIG.packages || {});
        return send(res, 200, {
          ok: true,
          upi: upi,
          packages: allPackages
        });
      }

      // ---------- UPI: Verify & Submit Order for Admin Approval ----------
      if (req.method === 'POST' && (url.pathname === '/api/pay/verify-utr' || url.pathname === '/api/pay/submit-order')) {
        const body = await readBody(req);
        let { player, edition, packageId, utr } = body;
        if (!player || typeof player !== 'string') return send(res, 400, { ok: false, error: 'Player Minecraft username is required.' });
        player = player.trim();
        const ed = (edition === 'bedrock' || player.startsWith('.')) ? 'bedrock' : 'java';
        let cleanPlayer = player;
        let inGamePlayer = player;

        if (ed === 'bedrock') {
          cleanPlayer = player.replace(/^\.+/, '').trim();
          if (!cleanPlayer || cleanPlayer.length < 1 || cleanPlayer.length > 16 || !/^[A-Za-z0-9_ ]+$/.test(cleanPlayer)) {
            return send(res, 400, { ok: false, error: 'Invalid Bedrock gamertag (1-16 characters: letters, numbers, spaces or _).' });
          }
          inGamePlayer = '.' + cleanPlayer;
        } else {
          if (!NAME_RE.java.test(player)) {
            return send(res, 400, { ok: false, error: 'Invalid Java player username (3-16 characters: letters, numbers or _).' });
          }
        }

        // Match Package
        const allPackages = Object.assign({}, DEFAULT_PACKAGES, CONFIG.packages || {});
        const pkg = allPackages[String(packageId || '').trim()];
        if (!pkg) {
          return send(res, 400, { ok: false, error: 'Invalid store package selected.' });
        }

        // Optional UTR Handling
        const rawUtr = String(utr || '').trim().replace(/[^0-9A-Za-z]/g, '').toUpperCase();
        const hasUtr = rawUtr.length >= 6;

        // Replay Protection (Duplicate UTR Check)
        if (hasUtr && utrs[rawUtr]) {
          const existingOrderId = utrs[rawUtr];
          const existingOrder = orders[existingOrderId];
          if (existingOrder && (existingOrder.status === 'APPROVED' || existingOrder.status === 'PENDING')) {
            return send(res, 400, {
              ok: false,
              error: `Yeh UTR (${rawUtr}) pehle se submit ho chuka hai (Order #${existingOrder.id} - ${existingOrder.status})! Duplicate claim allowed nahi hai.`
            });
          }
        }

        // Check if user recently submitted an identical pending order (within 5 min)
        const recentPending = Object.values(orders).find(o =>
          o.status === 'PENDING' &&
          o.player.toLowerCase() === player.toLowerCase() &&
          o.packageId === String(packageId) &&
          (Date.now() - (o.createdAt || 0) < 5 * 60 * 1000)
        );
        if (recentPending) {
          return send(res, 200, {
            ok: true,
            status: 'PENDING',
            orderId: recentPending.id,
            package: recentPending.packageName,
            price: recentPending.price,
            message: 'Aapka order pehle se verification ke liye queue me hai!'
          });
        }

        // Generate Order ID & reference
        const orderId = 'AAG-' + Math.floor(1000 + Math.random() * 9000);
        const finalUtr = hasUtr ? rawUtr : ('UPI-DIRECT-' + Math.floor(1000 + Math.random() * 9000));
        const token = crypto.randomBytes(12).toString('hex');
        const now = Date.now();

        // Process & save screenshot proof (Strictly Mandatory)
        if (!body.screenshot || typeof body.screenshot !== 'string' || body.screenshot.indexOf('base64,') === -1) {
          return send(res, 400, { ok: false, error: 'Payment receipt ka screenshot upload karna zaroori hai.' });
        }

        let receiptUrl = null;
        try {
          const matches = body.screenshot.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            if (buffer.length < 50) {
              return send(res, 400, { ok: false, error: 'Invalid or empty screenshot image.' });
            }
            const filename = `${orderId}.jpg`;
            const filePath = path.join(RECEIPTS_DIR, filename);
            fs.writeFileSync(filePath, buffer);
            receiptUrl = `/receipts/${filename}`;
          } else {
            return send(res, 400, { ok: false, error: 'Invalid screenshot format.' });
          }
        } catch (e) {
          console.error('[RECEIPT SAVE ERROR]', e.message);
          return send(res, 400, { ok: false, error: 'Screenshot save nahi ho paya. Dobara try karein.' });
        }

        const order = {
          id: orderId,
          token: token,
          player: cleanPlayer,
          inGamePlayer: inGamePlayer,
          edition: ed,
          packageId: String(packageId),
          packageName: pkg.name,
          price: pkg.price,
          label: pkg.label || pkg.name,
          commands: (pkg.commands || ['addshards {player} 400']).map(c => c.replace(/\{player\}/g, inGamePlayer)),
          utr: finalUtr,
          utrProvided: hasUtr,
          receiptUrl: receiptUrl,
          hasReceipt: !!receiptUrl,
          status: 'PENDING',
          createdAt: now,
          approvedAt: null
        };
        orders[orderId] = order;
        ordersDb.save();
        if (hasUtr) {
          utrs[rawUtr] = orderId;
          utrsDb.save();
        }

        // Send Discord Webhook alert to Admin with 1-click Approval
        sendDiscordWebhook(order);

        console.log(`[STORE ORDER PENDING] Order ${orderId}: Player ${player} (${ed}) submitted Rs.${pkg.price} for ${pkg.name}. Mode: ${hasUtr ? 'UTR ' + rawUtr : 'Direct UPI'}`);

        return send(res, 200, {
          ok: true,
          status: 'PENDING',
          orderId: orderId,
          package: pkg.name,
          price: pkg.price,
          message: 'Your request has been submitted for moderation.'
        });
      }

      // ---------- UPI: Check Order Status (Polled by Player Modal) ----------
      if (req.method === 'GET' && url.pathname === '/api/pay/order-status') {
        const orderId = url.searchParams.get('orderId');
        const ord = orders[orderId];
        if (!ord) return send(res, 404, { ok: false, error: 'Order not found.' });
        return send(res, 200, {
          ok: true,
          status: ord.status,
          orderId: ord.id,
          player: ord.player,
          package: ord.packageName,
          price: ord.price,
          approvedAt: ord.approvedAt
        });
      }

      // ---------- UPI: 1-Click Approve / Reject Link (for Discord / Webhook) ----------
      if (req.method === 'GET' && url.pathname === '/api/pay/action') {
        const orderId = url.searchParams.get('orderId');
        const token = url.searchParams.get('token');
        const action = (url.searchParams.get('action') || '').toLowerCase(); // 'approve' or 'reject'

        const ord = orders[orderId];
        if (!ord || ord.token !== token) {
          res.writeHead(403, { 'Content-Type': 'text/html; charset=UTF-8' });
          return res.end('<h2 style="font-family:sans-serif;color:#ef4444;text-align:center;padding:40px;">❌ Error: Invalid or expired action link.</h2>');
        }

        if (action === 'approve') {
          if (ord.status === 'APPROVED') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            return res.end(`<h2 style="font-family:sans-serif;color:#10b981;text-align:center;padding:40px;">ℹ️ Order ${ord.id} is already APPROVED & delivered to ${ord.player}.</h2>`);
          }

          ord.status = 'APPROVED';
          ord.approvedAt = Date.now();
          ordersDb.save();

          // Queue reward to player account for Minecraft auto-delivery
          const cleanName = (ord.player || '').replace(/^\.+/, '');
          const userId = `${ord.edition}:${(ord.edition === 'bedrock' ? cleanName : ord.player).toLowerCase()}`;
          if (!users[userId]) {
            users[userId] = {
              name: ord.edition === 'bedrock' ? cleanName : ord.player,
              edition: ord.edition,
              created: Date.now(),
              lastSeen: Date.now(),
              pending: []
            };
          }
          const rewardItem = {
            id: ord.id,
            type: 'purchase',
            packageId: ord.packageId,
            utr: ord.utr,
            reward: {
              label: ord.label,
              commands: ord.commands
            },
            at: Date.now()
          };
          (users[userId].pending = users[userId].pending || []).push(rewardItem);
          usersDb.save();

          console.log(`[ORDER APPROVED via LINK] ${ord.id}: Delivered ${ord.packageName} to ${ord.player} (${ord.edition}). UTR: ${ord.utr}`);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          return res.end(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>Order Approved - AAG Store</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="background:#0b0d14;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:16px;text-align:center;">
              <div style="background:#161a26;border:1px solid #10b981;border-radius:24px;padding:36px 28px;max-width:440px;box-shadow:0 15px 50px rgba(0,0,0,0.7);">
                <div style="font-size:54px;margin-bottom:12px;">✅</div>
                <h2 style="margin:0 0 10px;color:#10b981;font-size:26px;">Order Approved!</h2>
                <p style="font-size:16px;color:#cbd5e1;line-height:1.6;margin:0 0 20px;">
                  Order <b>${ord.id}</b> for <b>${ord.packageName} (₹${ord.price})</b> has been successfully approved.<br/>
                  Shards are being delivered to <b>${ord.player}</b> in Minecraft right now!
                </p>
                <div style="padding:12px;background:#0d1019;border-radius:12px;font-size:13px;color:#94a3b8;">
                  Player: <b style="color:#fff">${ord.player}</b> • UTR: <code>${ord.utr}</code>
                </div>
              </div>
            </body>
            </html>
          `);
        }

        if (action === 'reject') {
          ord.status = 'REJECTED';
          delete utrs[ord.utr];
          ordersDb.save();
          utrsDb.save();

          console.log(`[ORDER REJECTED via LINK] ${ord.id}: Rejected for ${ord.player}.`);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          return res.end(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>Order Rejected - AAG Store</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="background:#0b0d14;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:16px;text-align:center;">
              <div style="background:#161a26;border:1px solid #ef4444;border-radius:24px;padding:36px 28px;max-width:440px;box-shadow:0 15px 50px rgba(0,0,0,0.7);">
                <div style="font-size:54px;margin-bottom:12px;">❌</div>
                <h2 style="margin:0 0 10px;color:#ef4444;font-size:26px;">Order Rejected</h2>
                <p style="font-size:16px;color:#cbd5e1;line-height:1.6;margin:0 0 20px;">
                  Order <b>${ord.id}</b> for <b>${ord.player}</b> was rejected. No items were delivered to the player.
                </p>
              </div>
            </body>
            </html>
          `);
        }

        return send(res, 400, { ok: false, error: 'Invalid action.' });
      }

      // ---------- Admin: Orders list & Stats ----------
      if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
        if (!isAdmin(req, url)) return send(res, 403, { ok: false, error: 'Unauthorized: Invalid Admin Key.' });
        const list = Object.values(orders).sort((a, b) => b.createdAt - a.createdAt);
        const stats = {
          total: list.length,
          pending: list.filter(o => o.status === 'PENDING').length,
          approved: list.filter(o => o.status === 'APPROVED').length,
          revenue: list.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + (o.price || 0), 0)
        };
        return send(res, 200, { ok: true, stats: stats, orders: list });
      }

      // ---------- Admin: 1-Click Approve / Reject Action (from Admin Panel or Minecraft) ----------
      if (req.method === 'POST' && url.pathname === '/api/admin/order-action') {
        if (!isAdmin(req, url)) return send(res, 403, { ok: false, error: 'Unauthorized: Invalid Admin Key.' });
        const body = await readBody(req);
        const { orderId, action } = body;
        const ord = orders[orderId];
        if (!ord) return send(res, 404, { ok: false, error: 'Order not found.' });

        if (action === 'approve') {
          if (ord.status === 'APPROVED') {
            return send(res, 200, { ok: true, message: `Order #${ord.id} is already approved.` });
          }
          ord.status = 'APPROVED';
          ord.approvedAt = Date.now();
          ordersDb.save();

          // Queue reward to player
          const cleanName = (ord.player || '').replace(/^\.+/, '');
          const userId = `${ord.edition}:${(ord.edition === 'bedrock' ? cleanName : ord.player).toLowerCase()}`;
          if (!users[userId]) {
            users[userId] = {
              name: ord.edition === 'bedrock' ? cleanName : ord.player,
              edition: ord.edition,
              created: Date.now(),
              lastSeen: Date.now(),
              pending: []
            };
          }
          const rewardItem = {
            id: ord.id,
            type: 'purchase',
            packageId: ord.packageId,
            utr: ord.utr,
            reward: {
              label: ord.label,
              commands: ord.commands
            },
            at: Date.now()
          };
          (users[userId].pending = users[userId].pending || []).push(rewardItem);
          usersDb.save();

          console.log(`[ORDER APPROVED by ADMIN] ${ord.id}: ${ord.packageName} delivered to ${ord.player}.`);
          return send(res, 200, { ok: true, status: 'APPROVED', message: `Order #${ord.id} approved! ${ord.packageName} sent to ${ord.player}.` });
        }

        if (action === 'reject') {
          ord.status = 'REJECTED';
          delete utrs[ord.utr];
          ordersDb.save();
          utrsDb.save();
          console.log(`[ORDER REJECTED by ADMIN] ${ord.id}: Rejected for ${ord.player}.`);
          return send(res, 200, { ok: true, status: 'REJECTED', message: `Order #${ord.id} rejected.` });
        }

        return send(res, 400, { ok: false, error: 'Invalid action. Must be approve or reject.' });
      }

      // ---------- Admin: Users list ----------
      if (req.method === 'GET' && url.pathname === '/api/users') {
        if (!isAdmin(req, url)) return send(res, 403, { ok: false, error: 'Unauthorized: Invalid Admin Key.' });
        return send(res, 200, { ok: true, count: Object.keys(users).length, users: Object.values(users) });
      }

      return send(res, 404, { ok: false, error: 'Endpoint not found.' });
    }

    // ==========================================
    // STATIC FILE SERVER
    // ==========================================
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (serveStatic(req, res, url.pathname)) {
        return;
      }
    }

    send(res, 404, { ok: false, error: 'Not found' });
  } catch (e) {
    console.error('Server error:', e);
    send(res, 500, { ok: false, error: 'Internal Server Error' });
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

server.on('error', (err) => {
  console.error('HTTP Server Error:', err);
});
server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`  AAG SMP Store & API is live!`);
  console.log(`  Local URL:  http://localhost:${PORT}`);
  console.log(`  IPv4 URL:   http://127.0.0.1:${PORT}`);
  console.log(`  Admin Key:  ${ADMIN_KEY}`);
  console.log(`=========================================`);
});
