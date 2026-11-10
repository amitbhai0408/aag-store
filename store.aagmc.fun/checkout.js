/* ========================================================
   AAG SMP STORE - INSTANT UPI CHECKOUT & AUTO-DELIVERY
   Zero-KYC, 100% Direct UPI with 1-Click "I Have Paid" Verification
   ======================================================== */
(function () {
  'use strict';

  var UPI_VPA = '6295282909@fam';
  var UPI_NAME = 'AAG SMP';
  var FAMPAY_IMG = 'images/fampay-qr.jpg';

  var PACKAGES = {
    '7446855': { id: '7446855', name: '400 Shards', price: 29, label: '400 Shards' },
    '7446857': { id: '7446857', name: '2,500 Shards', price: 99, label: '2,500 Shards' },
    '7446858': { id: '7446858', name: '5,500 Shards', price: 199, label: '5,500 Shards' },
    '7446861': { id: '7446861', name: '12,000 Shards', price: 399, label: '12,000 Shards' },
    '7446862': { id: '7446862', name: '32,000 Shards', price: 999, label: '32,000 Shards' },
    '7446865': { id: '7446865', name: '70,000 Shards', price: 1999, label: '70,000 Shards' },
    '5999412': { id: '5999412', name: 'VIP Rank (30 Days)', price: 99, label: 'VIP Rank (30 Days)' },
    '7446586': { id: '7446586', name: 'MVP Rank (30 Days)', price: 199, label: 'MVP Rank (30 Days)' },
    '7706179': { id: '7706179', name: 'ELITE Rank (30 Days)', price: 499, label: 'ELITE Rank (30 Days)' },
    '810000': { id: '810000', name: 'Common Crate Key', price: 9, label: '1x Common Crate Key' },
    '810001': { id: '810001', name: 'Prime Crate Key', price: 19, label: '1x Prime Crate Key' },
    '810002': { id: '810002', name: 'Crimson Crate Key', price: 39, label: '1x Crimson Crate Key' },
    '810003': { id: '810003', name: 'Gold Crate Key', price: 69, label: '1x Gold Crate Key' },
    '810004': { id: '810004', name: 'All 4 Keys Mega Pack', price: 119, label: '1x Common + 1x Prime + 1x Crimson + 1x Gold Key' }
  };

  var activePkg = null;
  var pollInterval = null;
  var currentOrderId = null;
  var currentScreenshotBase64 = null;

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function startOrderStatusPolling(orderId, player, pkgName) {
    stopPolling();
    currentOrderId = orderId;
    pollInterval = setInterval(function () {
      fetch(getApiUrl() + '/api/pay/order-status?orderId=' + encodeURIComponent(orderId))
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) return;
          if (res.status === 'APPROVED') {
            stopPolling();
            renderApprovedView(pkgName, player);
          } else if (res.status === 'REJECTED') {
            stopPolling();
            renderRejectedView();
          }
        })
        .catch(function () {});
    }, 3000);
  }

  function getApiUrl() {
    if (window.AAG_CONFIG && window.AAG_CONFIG.apiUrl) {
      return window.AAG_CONFIG.apiUrl.replace(/\/+$/, '');
    }
    return (window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
  }

  function getLoggedInUser() {
    if (window.AAG && typeof window.AAG.getUser === 'function') {
      return window.AAG.getUser();
    }
    try {
      var v = localStorage.getItem('aag_user');
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }

  // Inject CSS
  var CSS = `
  #aag-checkout-modal-overlay {
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(4, 7, 14, 0.88);
    backdrop-filter: blur(10px);
    display: none; align-items: center; justify-content: center;
    padding: 16px;
    font-family: 'proxima-nova', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #f1f5f9;
    animation: aagFadeIn 0.25s ease-out;
  }
  @keyframes aagFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes aagSlideUp {
    from { opacity: 0; transform: translateY(18px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes aagPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }
  @keyframes aagGlow {
    0%, 100% { box-shadow: 0 4px 18px rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 4px 28px rgba(16, 185, 129, 0.7); }
  }
  #aag-checkout-modal {
    background: #141721;
    border: 1px solid #282f44;
    border-radius: 24px;
    box-shadow: 0 25px 65px rgba(0,0,0,0.85), 0 0 40px rgba(10, 108, 255, 0.15);
    width: 100%; max-width: 480px;
    max-height: 92vh;
    overflow-y: auto;
    position: relative;
    animation: aagSlideUp 0.25s ease-out;
  }
  .aag-ch-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid #1f2537;
  }
  .aag-ch-title {
    display: flex; align-items: center; gap: 10px;
    font-size: 19px; font-weight: 800; color: #fff;
  }
  .aag-ch-title span.badge {
    background: #00F0FF; color: #040814; font-size: 11px; font-weight: 900;
    padding: 3px 8px; border-radius: 6px; text-transform: uppercase;
  }
  .aag-ch-close {
    background: #1f2537; border: 0; color: #94a3b8; font-size: 24px; line-height: 1;
    width: 34px; height: 34px; border-radius: 50%; cursor: pointer;
    display: grid; place-items: center; transition: all 0.15s;
  }
  .aag-ch-close:hover { background: #334155; color: #fff; }
  .aag-ch-body { padding: 20px 24px; }

  /* Selected package card */
  .aag-pkg-card {
    background: linear-gradient(135deg, #1b2133 0%, #171c2b 100%);
    border: 1px solid #2d3752;
    border-radius: 16px; padding: 14px 18px;
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20px;
  }
  .aag-pkg-info { display: flex; flex-direction: column; gap: 3px; }
  .aag-pkg-name { font-size: 18px; font-weight: 800; color: #38bdf8; }
  .aag-pkg-sub { font-size: 12px; color: #94a3b8; }
  .aag-pkg-price {
    background: #0a6cff; color: #fff; font-size: 18px; font-weight: 900;
    padding: 6px 14px; border-radius: 10px; box-shadow: 0 4px 14px rgba(10, 108, 255, 0.4);
  }

  /* Player input group */
  .aag-field-group { margin-bottom: 18px; }
  .aag-field-label { display: block; font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; }
  .aag-user-row { display: flex; gap: 10px; }
  .aag-input {
    flex: 1; background: #0b0d14; border: 1px solid #232a3d; border-radius: 12px;
    padding: 12px 14px; font-size: 15px; color: #fff; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aag-input:focus { border-color: #00F0FF; box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.2); }
  .aag-input.shake {
    animation: aagShake 0.4s ease-in-out;
    border-color: #ef4444 !important;
  }
  @keyframes aagShake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  .aag-edition-toggle {
    display: flex; background: #0b0d14; border: 1px solid #232a3d; border-radius: 12px; padding: 3px;
  }
  .aag-ed-btn {
    border: 0; background: transparent; color: #94a3b8; font-size: 13px; font-weight: 700;
    padding: 8px 12px; border-radius: 9px; cursor: pointer; transition: all 0.15s;
  }
  .aag-ed-btn.active { background: #0a6cff; color: #fff; }

  /* Payment Section */
  .aag-pay-section {
    background: #0d1019; border: 1px dashed #28334a; border-radius: 18px;
    padding: 18px; text-align: center; margin-bottom: 18px;
  }
  .aag-qr-box {
    width: 200px; height: 200px; margin: 0 auto 12px; background: #fff;
    border-radius: 14px; padding: 10px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .aag-qr-box img { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; }
  .aag-vpa-copy {
    display: inline-flex; align-items: center; gap: 8px;
    background: #181d2a; border: 1px solid #2b354d; border-radius: 999px;
    padding: 6px 14px; font-size: 13px; color: #38bdf8; cursor: pointer;
    transition: all 0.15s;
  }
  .aag-vpa-copy:hover { background: #22293b; color: #fff; border-color: #3b82f6; }
  .aag-upi-intent-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; background: linear-gradient(135deg, #0a6cff 0%, #00d2ff 100%);
    color: #fff; font-size: 14px; font-weight: 800; text-decoration: none;
    padding: 11px 16px; border-radius: 12px; margin-top: 14px;
    box-shadow: 0 4px 18px rgba(10, 108, 255, 0.45); transition: transform 0.15s;
    box-sizing: border-box;
  }
  .aag-upi-intent-btn:hover { transform: translateY(-1px); }

  /* Screenshot Receipt Box */
  .aag-receipt-section {
    background: #0d1019; border: 1px dashed #28334a; border-radius: 16px;
    padding: 13px 15px; margin-bottom: 14px; text-align: left;
  }
  .aag-receipt-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
  }
  .aag-receipt-label { font-size: 13px; font-weight: 700; color: #cbd5e1; }
  .aag-receipt-badge {
    background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 10.5px;
    font-weight: 800; padding: 2px 7px; border-radius: 6px; text-transform: uppercase;
  }
  .aag-receipt-dropzone {
    background: #141724; border: 1.5px dashed #2d3752; border-radius: 12px;
    padding: 12px; text-align: center; cursor: pointer; transition: all 0.2s;
  }
  .aag-receipt-dropzone:hover { border-color: #00F0FF; background: #171c2c; }

  /* 1-Click Paid Action Box */
  .aag-action-box {
    background: #161a26; border: 1px solid #242c40; border-radius: 18px; padding: 18px;
    text-align: center; margin-bottom: 8px;
  }
  .aag-paid-btn {
    width: 100%; border: 0; background: #10b981; color: #041f14;
    font-size: 17px; font-weight: 900; padding: 15px 20px; border-radius: 14px;
    cursor: pointer; transition: all 0.15s;
    animation: aagGlow 2.5s infinite;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    letter-spacing: -0.2px;
  }
  .aag-paid-btn:hover { background: #34d399; transform: translateY(-1px); }
  .aag-paid-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; animation: none; }
  .aag-paid-caption {
    font-size: 12px; color: #94a3b8; margin-top: 8px; line-height: 1.4;
  }

  /* Live Radar Pulse */
  .aag-live-radar {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.3);
    padding: 6px 14px; border-radius: 999px; font-size: 12px; color: #38bdf8; font-weight: 700;
  }
  .aag-pulse-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #38bdf8;
    animation: aagPulse 1.2s infinite ease-in-out;
  }

  /* Status alerts */
  .aag-status-msg {
    margin-top: 12px; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
    display: none; line-height: 1.4;
  }
  .aag-status-msg.error { display: block; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; }
  .aag-status-msg.loading { display: block; background: rgba(14, 165, 233, 0.15); border: 1px solid #0ea5e9; color: #7dd3fc; text-align: center; }
  `;

  function injectModal() {
    if (document.getElementById('aag-checkout-modal-overlay')) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var overlay = document.createElement('div');
    overlay.id = 'aag-checkout-modal-overlay';
    overlay.innerHTML = `
      <div id="aag-checkout-modal">
        <div class="aag-ch-head">
          <div class="aag-ch-title">
            <span>AAG Store</span>
            <span class="badge">Direct UPI</span>
          </div>
          <button type="button" class="aag-ch-close" id="aag-modal-close-btn">&times;</button>
        </div>
        <div class="aag-ch-body" id="aag-modal-body">
          <div class="aag-pkg-card">
            <div class="aag-pkg-info">
              <div class="aag-pkg-name" id="aag-modal-pkg-name">400 Shards</div>
              <div class="aag-pkg-sub">Instant in-game delivery</div>
            </div>
            <div class="aag-pkg-price" id="aag-modal-pkg-price">₹29</div>
          </div>

          <div id="aag-form-section">
            <div class="aag-field-group">
              <label class="aag-field-label">1. Enter Minecraft Username</label>
              <div class="aag-user-row">
                <input type="text" class="aag-input" id="aag-player-input" placeholder="Your Minecraft Username" maxlength="20" />
                <div class="aag-edition-toggle">
                  <button type="button" class="aag-ed-btn active" data-ed="java">Java</button>
                  <button type="button" class="aag-ed-btn" data-ed="bedrock">Bedrock</button>
                </div>
              </div>
            </div>

            <div class="aag-pay-section">
              <div style="font-size:14px; font-weight:800; color:#38bdf8; margin-bottom:12px;">
                ⚡ Scan &amp; Pay via UPI &bull; ₹<span id="aag-qr-price">29</span>
              </div>
              <div class="aag-qr-box">
                <img id="aag-qr-img" src="" alt="UPI QR Code" />
              </div>
              <div>
                <span class="aag-vpa-copy" id="aag-copy-upi-btn" title="Click to copy UPI ID">
                  <span>6295282909@fam</span>
                  <span id="aag-copy-label">📋 Copy</span>
                </span>
              </div>
              <a id="aag-mobile-pay-btn" class="aag-upi-intent-btn" href="#">
                ⚡ Pay via UPI App (GPay / PhonePe / Paytm / FamPay)
              </a>
              <div style="font-size:11.5px; color:#94a3b8; margin-top:10px; line-height:1.4;">
                💡 <b>Tip:</b> Payment note me apna username (<b style="color:#38bdf8;" id="aag-note-player-preview">username</b>) likhein for instant verification.
              </div>
            </div>

            <div class="aag-receipt-section">
              <div class="aag-receipt-header">
                <span class="aag-receipt-label">📸 Payment Screenshot (Receipt) <span style="color:#f87171;">*</span></span>
                <span class="aag-receipt-badge" style="background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.35);">Required</span>
              </div>
              <input type="file" id="aag-screenshot-input" accept="image/*" style="display:none;" />
              <div class="aag-receipt-dropzone" id="aag-screenshot-dropzone">
                <div id="aag-ss-placeholder">
                  <div style="font-size:24px; margin-bottom:4px;">🖼️</div>
                  <div style="font-size:13px; font-weight:700; color:#38bdf8;">Attach Payment Screenshot *</div>
                  <div style="font-size:11px; color:#94a3b8; margin-top:3px;">Tap to select receipt from Gallery (GPay, PhonePe, Paytm, FamPay)</div>
                </div>
                <div id="aag-ss-preview-wrap" style="display:none; align-items:center; gap:12px; padding:4px;">
                  <img id="aag-ss-preview-img" src="" alt="Proof" style="width:50px; height:50px; object-fit:cover; border-radius:8px; border:1px solid #38bdf8;" />
                  <div style="flex:1; text-align:left; overflow:hidden;">
                    <div id="aag-ss-filename" style="font-size:13px; font-weight:700; color:#fff; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">screenshot.jpg</div>
                    <div style="font-size:11px; color:#34d399;">✓ Screenshot attached!</div>
                  </div>
                  <button type="button" id="aag-ss-remove-btn" style="background:#232a3d; border:0; color:#f87171; width:28px; height:28px; border-radius:50%; font-size:16px; cursor:pointer; display:grid; place-items:center;">&times;</button>
                </div>
              </div>
            </div>

            <div class="aag-action-box">
              <button type="button" class="aag-paid-btn" id="aag-confirm-paid-btn">
                <span>✅</span>
                <span>Yes, I Have Paid</span>
              </button>
              <div class="aag-paid-caption">
                Screenshot attach karne ke baad yahan click karein &mdash; moderation queue me chala jayega!
              </div>

              <div style="margin-top:12px; font-size:12px;">
                <a href="javascript:void(0)" id="aag-toggle-utr-link" style="color:#64748b; text-decoration:none;">
                  + Have 12-digit UTR? (Optional)
                </a>
              </div>
              <div id="aag-optional-utr-wrap" style="display:none; margin-top:10px;">
                <input type="text" class="aag-input" id="aag-utr-input" placeholder="12-digit UTR / Ref No. (Optional)" maxlength="22" style="width:100%; box-sizing:border-box; font-size:13px; text-transform:uppercase;" />
              </div>

              <div id="aag-checkout-status" class="aag-status-msg"></div>
            </div>
          </div>

          <div id="aag-pending-section" style="display:none;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire up events
    document.getElementById('aag-modal-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Edition buttons
    var edBtns = overlay.querySelectorAll('.aag-ed-btn');
    var pInput = document.getElementById('aag-player-input');
    edBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        edBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var ed = btn.getAttribute('data-ed');
        if (pInput) {
          pInput.placeholder = (ed === 'bedrock') ? 'Your Bedrock Gamertag (e.g. Amit)' : 'Your Java Username';
        }
        updateQrDisplay();
      });
    });

    // Copy UPI ID
    document.getElementById('aag-copy-upi-btn').addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(UPI_VPA);
      } else {
        var t = document.createElement('textarea');
        t.value = UPI_VPA; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
      }
      var lbl = document.getElementById('aag-copy-label');
      lbl.textContent = '✓ Copied!';
      setTimeout(function () { lbl.textContent = '📋 Copy'; }, 2000);
    });

    // Optional UTR toggle
    document.getElementById('aag-toggle-utr-link').addEventListener('click', function () {
      var wrap = document.getElementById('aag-optional-utr-wrap');
      var isHidden = wrap.style.display === 'none';
      wrap.style.display = isHidden ? 'block' : 'none';
      this.textContent = isHidden ? '- Hide UTR input' : '+ Have 12-digit UTR? (Optional)';
      if (isHidden) {
        document.getElementById('aag-utr-input').focus();
      }
    });

    // 1-Click Paid button
    document.getElementById('aag-confirm-paid-btn').addEventListener('click', handlePaidSubmit);

    // Screenshot dropzone click
    document.getElementById('aag-screenshot-dropzone').addEventListener('click', function (e) {
      if (e.target.closest('#aag-ss-remove-btn')) return;
      document.getElementById('aag-screenshot-input').click();
    });

    // File input change
    document.getElementById('aag-screenshot-input').addEventListener('change', function () {
      if (this.files && this.files[0]) {
        handleFileSelect(this.files[0]);
      }
    });

    // Remove screenshot
    document.getElementById('aag-ss-remove-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      removeScreenshot();
    });
  }

  function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Kripya valid image file select karein.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var maxDim = 1200;
        var width = img.width;
        var height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        currentScreenshotBase64 = canvas.toDataURL('image/jpeg', 0.85);

        // Show preview
        var ph = document.getElementById('aag-ss-placeholder');
        if (ph) ph.style.display = 'none';
        var prevWrap = document.getElementById('aag-ss-preview-wrap');
        if (prevWrap) prevWrap.style.display = 'flex';
        var prevImg = document.getElementById('aag-ss-preview-img');
        if (prevImg) prevImg.src = currentScreenshotBase64;
        var fn = document.getElementById('aag-ss-filename');
        if (fn) fn.textContent = file.name || 'screenshot.jpg';

        var dropzone = document.getElementById('aag-screenshot-dropzone');
        if (dropzone) dropzone.style.borderColor = '';
        var statusEl = document.getElementById('aag-checkout-status');
        if (statusEl && statusEl.classList.contains('error')) {
          statusEl.style.display = 'none';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeScreenshot() {
    currentScreenshotBase64 = null;
    var fileInput = document.getElementById('aag-screenshot-input');
    if (fileInput) fileInput.value = '';
    var ph = document.getElementById('aag-ss-placeholder');
    if (ph) ph.style.display = 'block';
    var prevWrap = document.getElementById('aag-ss-preview-wrap');
    if (prevWrap) prevWrap.style.display = 'none';
    var prevImg = document.getElementById('aag-ss-preview-img');
    if (prevImg) prevImg.src = '';
  }

  function updateQrDisplay() {
    var qrImg = document.getElementById('aag-qr-img');
    if (!qrImg || !activePkg) return;

    var qrPriceEl = document.getElementById('aag-qr-price');
    if (qrPriceEl) qrPriceEl.textContent = activePkg.price;

    var player = (document.getElementById('aag-player-input').value || 'player').trim();
    var previewEl = document.getElementById('aag-note-player-preview');
    if (previewEl) previewEl.textContent = player;
    var upiUri = 'upi://pay?pa=' + encodeURIComponent(UPI_VPA) +
                 '&pn=' + encodeURIComponent(UPI_NAME) +
                 '&am=' + activePkg.price +
                 '&cu=INR' +
                 '&tn=' + encodeURIComponent('AAG_' + activePkg.id + '_' + player);
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(upiUri);

    var intentBtn = document.getElementById('aag-mobile-pay-btn');
    if (intentBtn) intentBtn.href = upiUri;
  }

  function openModal(pkg) {
    injectModal();
    activePkg = pkg;

    // Reset sections
    document.getElementById('aag-form-section').style.display = 'block';
    var pendingSection = document.getElementById('aag-pending-section');
    pendingSection.style.display = 'none';
    pendingSection.innerHTML = '';

    document.getElementById('aag-modal-pkg-name').textContent = pkg.name;
    document.getElementById('aag-modal-pkg-price').textContent = '₹' + pkg.price;
    var qrPriceEl = document.getElementById('aag-qr-price');
    if (qrPriceEl) qrPriceEl.textContent = pkg.price;

    var statusEl = document.getElementById('aag-checkout-status');
    statusEl.className = 'aag-status-msg';
    statusEl.textContent = '';
    document.getElementById('aag-utr-input').value = '';
    document.getElementById('aag-optional-utr-wrap').style.display = 'none';
    document.getElementById('aag-toggle-utr-link').textContent = '+ Have 12-digit UTR? (Optional)';
    document.getElementById('aag-confirm-paid-btn').disabled = false;
    removeScreenshot();

    // Pre-fill player username
    var u = getLoggedInUser();
    var playerInput = document.getElementById('aag-player-input');
    if (u && u.name) {
      var ed = (u.edition === 'bedrock' || u.name.startsWith('.')) ? 'bedrock' : 'java';
      playerInput.value = (ed === 'bedrock') ? u.name.replace(/^\.+/, '') : u.name;
      playerInput.placeholder = (ed === 'bedrock') ? 'Your Bedrock Gamertag (e.g. Amit)' : 'Your Java Username';
      var edBtns = document.querySelectorAll('.aag-ed-btn');
      edBtns.forEach(function (b) {
        if (b.getAttribute('data-ed') === ed) b.classList.add('active');
        else b.classList.remove('active');
      });
    }

    updateQrDisplay();

    // Listen to player name changes to refresh note in dynamic QR
    playerInput.oninput = function () {
      updateQrDisplay();
    };

    var overlay = document.getElementById('aag-checkout-modal-overlay');
    overlay.style.display = 'flex';
  }

  function closeModal() {
    stopPolling();
    var overlay = document.getElementById('aag-checkout-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function handlePaidSubmit() {
    var playerInput = document.getElementById('aag-player-input');
    var player = (playerInput.value || '').trim();
    var activeEdBtn = document.querySelector('.aag-ed-btn.active');
    var edition = activeEdBtn ? activeEdBtn.getAttribute('data-ed') : 'java';
    var utr = (document.getElementById('aag-utr-input').value || '').trim();
    var statusEl = document.getElementById('aag-checkout-status');
    var btn = document.getElementById('aag-confirm-paid-btn');

    if (!player) {
      playerInput.classList.add('shake');
      setTimeout(function () { playerInput.classList.remove('shake'); }, 500);
      playerInput.focus();
      statusEl.className = 'aag-status-msg error';
      statusEl.textContent = 'Kripya pehle apna Minecraft username enter karein.';
      return;
    }

    if (edition === 'bedrock') {
      var clean = player.replace(/^\.+/, '');
      if (!clean || clean.length < 1 || clean.length > 16 || !/^[A-Za-z0-9_ ]+$/.test(clean)) {
        playerInput.classList.add('shake');
        setTimeout(function () { playerInput.classList.remove('shake'); }, 500);
        playerInput.focus();
        statusEl.className = 'aag-status-msg error';
        statusEl.textContent = 'Invalid Bedrock gamertag (1-16 characters: letters, numbers, spaces or _).';
        return;
      }
    } else {
      if (!/^[A-Za-z0-9_]{3,16}$/.test(player)) {
        playerInput.classList.add('shake');
        setTimeout(function () { playerInput.classList.remove('shake'); }, 500);
        playerInput.focus();
        statusEl.className = 'aag-status-msg error';
        statusEl.textContent = 'Invalid Java username (3-16 characters: letters, numbers or _ only).';
        return;
      }
    }

    if (!currentScreenshotBase64) {
      var dropzone = document.getElementById('aag-screenshot-dropzone');
      if (dropzone) {
        dropzone.classList.add('shake');
        dropzone.style.borderColor = '#ef4444';
        setTimeout(function () { dropzone.classList.remove('shake'); }, 500);
      }
      statusEl.className = 'aag-status-msg error';
      statusEl.textContent = 'Payment receipt ka screenshot upload karna zaroori hai.';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>Submitting...</span>';
    statusEl.className = 'aag-status-msg loading';
    statusEl.innerHTML = '⏳ Submitting your request for moderation...';

    var payload = {
      player: player,
      edition: edition,
      packageId: activePkg.id,
      utr: utr,
      screenshot: currentScreenshotBase64
    };

    fetch(getApiUrl() + '/api/pay/verify-utr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        btn.disabled = false;
        btn.innerHTML = '<span>✅</span><span>Yes, I Have Paid</span>';
        if (data && data.ok) {
          renderPendingView(data.orderId, player, data.package || activePkg.name, activePkg.price);
          startOrderStatusPolling(data.orderId, player, data.package || activePkg.name);
        } else {
          statusEl.className = 'aag-status-msg error';
          statusEl.textContent = (data && data.error) ? data.error : 'Order submit nahi ho paya. Details check karein.';
        }
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = '<span>✅</span><span>Yes, I Have Paid</span>';
        statusEl.className = 'aag-status-msg error';
        statusEl.textContent = 'Server se connect nahi ho paya. Kripya dobara try karein.';
      });
  }

  function renderPendingView(orderId, player, pkgName, price) {
    document.getElementById('aag-form-section').style.display = 'none';
    var section = document.getElementById('aag-pending-section');
    section.style.display = 'block';
    section.innerHTML = `
      <div style="text-align:center; padding:10px 4px; animation: aagSlideUp 0.25s ease-out;">
        <div style="font-size:46px; margin-bottom:12px;">⏳</div>
        <div style="font-size:19px; font-weight:800; color:#facc15; margin-bottom:8px; line-height:1.35;">
          Your request has been submitted for moderation.
        </div>
        <div style="display:inline-block; background:#1e2538; color:#38bdf8; font-family:monospace; font-weight:700; font-size:13px; padding:4px 12px; border-radius:8px; margin-bottom:14px;">
          Order #${orderId} &bull; ${pkgName} (₹${price})
        </div>
        <p style="color:#cbd5e1; font-size:14px; line-height:1.6; margin:0 0 16px;">
          Our moderators will review and verify your payment shortly.<br/>
          Once approved, <b>${pkgName}</b> will be delivered automatically to your Minecraft account (<b>${player}</b>)!
        </p>

        <div class="aag-live-radar" style="margin-bottom:16px;">
          <span class="aag-pulse-dot"></span>
          <span>Waiting for moderator approval &bull; auto-checking live...</span>
        </div>

        <div style="margin-bottom:14px; background:linear-gradient(135deg, rgba(88,101,242,0.15) 0%, rgba(88,101,242,0.06) 100%); border:1px solid rgba(88,101,242,0.35); border-radius:14px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; text-align:left;">
          <div>
            <div style="font-size:13px; font-weight:700; color:#fff;">Need help or have questions?</div>
            <div style="font-size:12px; color:#94a3b8;">Join our Discord server to open a support ticket.</div>
          </div>
          <a href="https://discord.gg/bvVstrXWDC" target="_blank" rel="noopener noreferrer" style="background:#5865F2; color:#fff; text-decoration:none; padding:8px 14px; border-radius:10px; font-size:12px; font-weight:800; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; box-shadow:0 4px 12px rgba(88,101,242,0.35);">
            <span>💬 Need Help?</span>
          </a>
        </div>

        <div style="background:#0c101a; border:1px solid #1f283c; border-radius:14px; padding:12px 14px; font-size:12.5px; color:#94a3b8; text-align:left; line-height:1.5;">
          🎮 <b>Tips:</b>
          <ul style="margin:4px 0 0 18px; padding:0;">
            <li>You can keep this tab open or play in-game &mdash; rewards credit automatically!</li>
            <li>Upon approval, a chime will play in-game to notify you.</li>
          </ul>
        </div>
      </div>
    `;
  }

  function renderApprovedView(pkgName, player) {
    var section = document.getElementById('aag-pending-section');
    section.style.display = 'block';
    document.getElementById('aag-form-section').style.display = 'none';
    section.innerHTML = `
      <div style="text-align:center; padding:20px 8px; animation: aagSlideUp 0.3s ease-out;">
        <div style="font-size:54px; margin-bottom:12px;">🎉</div>
        <div style="font-size:22px; font-weight:900; color:#34d399; margin-bottom:6px;">
          Payment Approved!
        </div>
        <p style="color:#cbd5e1; font-size:15px; line-height:1.6; margin:0 0 16px;">
          <b>${pkgName}</b> aapke account (<b>${player}</b>) me successfully deliver ho chuke hain!
        </p>
        <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#6ee7b7; padding:8px 18px; border-radius:999px; font-size:13px; font-weight:700; margin-bottom:22px;">
          <span>✓ Delivered In-Game &bull; Enjoy!</span>
        </div>
        <div>
          <button type="button" class="aag-paid-btn" style="background:#1e293b; color:#fff; border:1px solid #334155; animation:none;" id="aag-done-btn">
            Done &amp; Close
          </button>
        </div>
      </div>
    `;
    var doneBtn = document.getElementById('aag-done-btn');
    if (doneBtn) doneBtn.addEventListener('click', closeModal);
  }

  function renderRejectedView() {
    var section = document.getElementById('aag-pending-section');
    section.style.display = 'block';
    document.getElementById('aag-form-section').style.display = 'none';
    section.innerHTML = `
      <div style="text-align:center; padding:20px 8px; animation: aagSlideUp 0.3s ease-out;">
        <div style="font-size:54px; margin-bottom:12px;">❌</div>
        <div style="font-size:20px; font-weight:800; color:#f87171; margin-bottom:8px;">
          Payment Not Verified
        </div>
        <p style="color:#cbd5e1; font-size:14px; line-height:1.6; margin:0 0 16px;">
          Payment receive nahi hua ya receipt screenshot match nahi hua.<br/>
          <small style="color:#94a3b8">Agar aapne payment kiya hai, to Discord ticket open karke payment receipt share karein.</small>
        </p>
        <button type="button" class="aag-paid-btn" style="background:#1e293b; color:#fff; border:1px solid #334155; animation:none;" id="aag-retry-btn">
          Back to Store
        </button>
      </div>
    `;
    var retryBtn = document.getElementById('aag-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', closeModal);
  }

  // Pre-sync packages dynamically from server config
  try {
    fetch(getApiUrl() + '/api/pay/config')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.packages) {
          Object.keys(res.packages).forEach(function (k) {
            PACKAGES[k] = res.packages[k];
          });
        }
      })
      .catch(function () {});
  } catch (e) {}

  // Hook into package buttons across store
  function attachPackageInterceptors() {
    document.addEventListener('click', function (e) {
      // Find closest clickable element or package card
      var target = e.target.closest('a, button, article[data-donut-plus-id], .donut-plus-package, [data-id]');
      if (!target) return;

      var card = target.closest('.donut-plus-package, article[data-donut-plus-id]') || target;
      var dataId = target.getAttribute('data-id') ||
                   target.getAttribute('data-donut-plus-id') ||
                   card.getAttribute('data-id') ||
                   card.getAttribute('data-donut-plus-id') ||
                   (card.querySelector('[data-id]') ? card.querySelector('[data-id]').getAttribute('data-id') : null);

      var checkoutLink = target.closest('a[href*="checkout"]') || card.querySelector('a[href*="checkout"]') || (target.tagName === 'A' ? target : null);
      var href = checkoutLink ? (checkoutLink.getAttribute('href') || '') : '';

      // Check if clicking a checkout link
      var match = href.match(/checkout\/packages\/add\/(\d+)/);
      var pkgId = (match ? match[1] : null) || dataId;

      if (pkgId && PACKAGES[pkgId]) {
        e.preventDefault();
        e.stopPropagation();
        openModal(PACKAGES[pkgId]);
        return;
      }

      if (pkgId && !PACKAGES[pkgId]) {
        e.preventDefault();
        e.stopPropagation();
        fetch(getApiUrl() + '/api/pay/config')
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res && res.packages && res.packages[pkgId]) {
              PACKAGES[pkgId] = res.packages[pkgId];
              openModal(PACKAGES[pkgId]);
            }
          })
          .catch(function () {});
        return;
      }

      // If clicked checkout button or purchase link with price
      if (checkoutLink && (href.indexOf('checkout') !== -1 || target.classList.contains('donut-purchase'))) {
        e.preventDefault();
        e.stopPropagation();
        var rawText = (target.textContent || '').replace(/[^\d]/g, '');
        var matched = Object.keys(PACKAGES).map(function (k) { return PACKAGES[k]; }).find(function (p) { return String(p.price) === rawText; });
        if (matched) {
          openModal(matched);
        }
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachPackageInterceptors);
  } else {
    attachPackageInterceptors();
  }

  window.AAGCheckout = {
    open: openModal,
    close: closeModal
  };
})();