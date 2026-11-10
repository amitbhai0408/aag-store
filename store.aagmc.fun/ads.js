/* AAG SMP - Universal Ad Injector & Anti-AdBlock System */
(function () {
  var isBlocked = false;

  function isFreeRewardsPage() {
    var p = '';
    try {
      p = (window.location.pathname || '').toLowerCase();
    } catch (e) {
      p = '';
    }
    var freePages = [
      'rewards.html',
      'afk-zone.html',
      'free-redeem-codes.html',
      'free-crate-keys.html',
      'step.html',
      'claim.html',
      '/rewards',
      '/afk-zone',
      '/free-redeem-codes',
      '/free-crate-keys',
      '/step',
      '/claim'
    ];
    for (var i = 0; i < freePages.length; i++) {
      if (p.indexOf(freePages[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function showAdBlockModal() {
    if (document.getElementById('aag-adblock-modal')) return;

    var style = document.createElement('style');
    style.textContent = ''
      + '#aag-adblock-modal { position: fixed; inset: 0; z-index: 9999999; background: rgba(5,5,5,0.92); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 20px; font-family: "proxima-nova", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }'
      + '.aag-ab-card { background: #16181e; border: 1px solid #ff4757; border-radius: 20px; max-width: 480px; width: 100%; padding: 32px 28px; text-align: center; box-shadow: 0 20px 60px rgba(255, 71, 87, 0.25); animation: aagPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }'
      + '@keyframes aagPop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }'
      + '.aag-ab-icon { width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 50%; background: rgba(255,71,87,0.15); border: 2px solid #ff4757; display: flex; align-items: center; justify-content: center; color: #ff4757; font-size: 34px; }'
      + '.aag-ab-title { font-size: 24px; font-weight: 900; color: #fff; margin: 0 0 10px; letter-spacing: -0.5px; }'
      + '.aag-ab-desc { color: #aaa; font-size: 14.5px; line-height: 1.6; margin: 0 0 24px; }'
      + '.aag-ab-steps { background: #0f1015; border-radius: 12px; padding: 14px 18px; text-align: left; margin-bottom: 24px; border: 1px solid #222; }'
      + '.aag-ab-steps p { margin: 6px 0; font-size: 13px; color: #ccc; }'
      + '.aag-ab-btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 50px; background: linear-gradient(135deg, #0a6cff, #00F0FF); color: #fff; font-weight: 800; font-size: 16px; border-radius: 12px; border: 0; cursor: pointer; text-decoration: none; box-shadow: 0 8px 24px rgba(0,240,255,0.3); transition: transform 0.2s, box-shadow 0.2s; }'
      + '.aag-ab-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,240,255,0.4); }';
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.id = 'aag-adblock-modal';
    modal.innerHTML = ''
      + '<div class="aag-ab-card">'
      + '  <div class="aag-ab-icon">🛡️</div>'
      + '  <h2 class="aag-ab-title">AdBlocker Detected</h2>'
      + '  <p class="aag-ab-desc">All in-game rewards are sponsored by ads. To support the server and earn your free Shards, please pause or disable your AdBlocker on this website.</p>'
      + '  <div class="aag-ab-steps">'
      + '    <p><b>1.</b> Open your ad-blocker extension (uBlock, AdBlock, Brave Shields, etc.).</p>'
      + '    <p><b>2.</b> Set it to <b>Pause</b> or turn it <b>OFF</b> for this site.</p>'
      + '    <p><b>3.</b> Click the button below to refresh and resume earning.</p>'
      + '  </div>'
      + '  <button class="aag-ab-btn" onclick="window.location.reload();">I\'ve Disabled AdBlock &mdash; Refresh</button>'
      + '</div>';
    document.body.appendChild(modal);
  }

  function triggerBlocked() {
    if (isBlocked) return;
    isBlocked = true;
    window.AAG_adBlocked = true;
    showAdBlockModal();
    try {
      document.dispatchEvent(new CustomEvent('aag:adblock', { detail: { blocked: true } }));
    } catch (e) {}
  }

  function checkAdBlock() {
    var bait = document.createElement('div');
    bait.className = 'adsbygoogle ad-placement advertisement pub_300x250 pub_728x90 text-ad textAd text_ad text_ads';
    bait.style.cssText = 'position: absolute !important; left: -9999px !important; top: -9999px !important; width: 1px !important; height: 1px !important; pointer-events: none !important;';
    document.body.appendChild(bait);

    setTimeout(function () {
      var isHidden = false;
      try {
        var style = window.getComputedStyle(bait);
        if (bait.offsetParent === null || bait.offsetHeight === 0 || bait.offsetWidth === 0 || style.display === 'none' || style.visibility === 'hidden') {
          isHidden = true;
        }
      } catch (e) {
        isHidden = true;
      }
      try { bait.parentNode.removeChild(bait); } catch (e) {}

      // Network test to ad script
      fetch('https://bauval.org/14/de895d268452bd717c705a048a7650cd', { method: 'HEAD', mode: 'no-cors' })
        .then(function () {
          if (isHidden) triggerBlocked();
        })
        .catch(function () {
          triggerBlocked();
        });

      if (isHidden) {
        triggerBlocked();
      }
    }, 600);
  }

  function injectCode(container, code) {
    if (!code || !String(code).trim()) return;
    container.innerHTML = code;
    var scripts = container.querySelectorAll('script');
    Array.prototype.forEach.call(scripts, function (oldScript) {
      var s = document.createElement('script');
      Array.prototype.forEach.call(oldScript.attributes, function (a) {
        s.setAttribute(a.name, a.value);
      });
      s.text = oldScript.text;
      oldScript.parentNode.replaceChild(s, oldScript);
    });
  }

  function run() {
    var cfg = window.AAG_CONFIG || {};
    var ads = cfg.ads || {};
    var onFreeRewards = isFreeRewardsPage();

    // 1. Social Bar (Floating notification ad)
    if (cfg.socialBar && String(cfg.socialBar).trim() && !document.getElementById('aag-social-bar')) {
      var sbHolder = document.createElement('div');
      sbHolder.id = 'aag-social-bar';
      sbHolder.style.display = 'none';
      injectCode(sbHolder, cfg.socialBar);
      document.body.appendChild(sbHolder);
    }

    // 2. Popunder (STRICTLY Free Rewards pages ONLY! Home page and Paid shop me KABHI trigger nahi hoga)
    if (onFreeRewards && cfg.popunder && String(cfg.popunder).trim() && !document.getElementById('aag-popunder')) {
      var popHolder = document.createElement('div');
      popHolder.id = 'aag-popunder';
      popHolder.style.display = 'none';
      injectCode(popHolder, cfg.popunder);
      document.body.appendChild(popHolder);
    }

    // 3. Banner Slots Across Pages (Only fills existing .ad-slot divs)
    Array.prototype.forEach.call(document.querySelectorAll('.ad-slot[data-ad]'), function (el) {
      var slotName = el.getAttribute('data-ad');
      var code = ads[slotName];
      if (!code || !String(code).trim()) return;
      el.innerHTML = '';
      el.classList.add('filled');
      injectCode(el, code);
    });

    // 4. Anti-Adblock Check (ONLY enforced on Free Rewards section so paid buyers are never interrupted)
    if (onFreeRewards) {
      checkAdBlock();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
