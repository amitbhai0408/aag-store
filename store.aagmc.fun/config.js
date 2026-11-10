/* ========================================================
   AAG SMP STORE - CONFIGURATION & ADSTERRA ADS SETUP
   ======================================================== */

window.AAG_CONFIG = {
  // Website API backend URL
  apiUrl: (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
    ? window.location.origin
    : "http://localhost:3000",

  // 1. SOCIAL BAR (Floating Notification Ad)
  socialBar: `<script data-cfasync="false" src="https://bauval.org/14/de895d268452bd717c705a048a7650cd"></script>`,

  // 2. POPUNDER (Monetag OnClick Popunder - Free Rewards Pages Only)
  popunder: `<script>(function(s){s.dataset.zone='12213644',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>`,

  // 3. DIRECT SMARTLINK (Monetag Direct Link for Code Links & Background AdTab)
  directLink: "https://uplcm.com/4/12213645",

  // 4. BANNER ADS: Adsterra Slots
  ads: {
    // 728x90 Leaderboard (Bottom of pages)
    "bottom": `<iframe srcdoc="<style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style><script>atOptions = {'key' : 'ef62238da05975044ac14125db7c0204','format' : 'iframe','height' : 90,'width' : 728,'params' : {}};</script><script src='https://bauval.org/22/ef62238da05975044ac14125db7c0204'></script>" width="728" height="90" frameborder="0" scrolling="no" style="border:0;overflow:hidden;max-width:100%;"></iframe>`,

    // 728x90 Leaderboard (AFK Zone middle)
    "afk-banner": `<iframe srcdoc="<style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style><script>atOptions = {'key' : 'ef62238da05975044ac14125db7c0204','format' : 'iframe','height' : 90,'width' : 728,'params' : {}};</script><script src='https://bauval.org/22/ef62238da05975044ac14125db7c0204'></script>" width="728" height="90" frameborder="0" scrolling="no" style="border:0;overflow:hidden;max-width:100%;"></iframe>`,

    // 160x600 Skyscraper (Left sidebar)
    "rail-left": `<iframe srcdoc="<style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style><script>atOptions = {'key' : '3ce3a41928f20c683b4961a6a6c972d9','format' : 'iframe','height' : 600,'width' : 160,'params' : {}};</script><script src='https://bauval.org/22/3ce3a41928f20c683b4961a6a6c972d9'></script>" width="160" height="600" frameborder="0" scrolling="no" style="border:0;overflow:hidden;"></iframe>`,

    // 160x600 Skyscraper (Right sidebar)
    "rail-right": `<iframe srcdoc="<style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style><script>atOptions = {'key' : '3ce3a41928f20c683b4961a6a6c972d9','format' : 'iframe','height' : 600,'width' : 160,'params' : {}};</script><script src='https://bauval.org/22/3ce3a41928f20c683b4961a6a6c972d9'></script>" width="160" height="600" frameborder="0" scrolling="no" style="border:0;overflow:hidden;"></iframe>`,

    // 160x600 Skyscraper (AFK Zone left)
    "afk-left": `<iframe srcdoc="<style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style><script>atOptions = {'key' : '3ce3a41928f20c683b4961a6a6c972d9','format' : 'iframe','height' : 600,'width' : 160,'params' : {}};</script><script src='https://bauval.org/22/3ce3a41928f20c683b4961a6a6c972d9'></script>" width="160" height="600" frameborder="0" scrolling="no" style="border:0;overflow:hidden;"></iframe>`,

    // 300x250 Medium Rectangle (AFK Zone right top)
    "afk-right-1": `<iframe srcdoc="<style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style><script>atOptions = {'key' : '853be10f029bc013a333811f216ce9e3','format' : 'iframe','height' : 250,'width' : 300,'params' : {}};</script><script src='https://bauval.org/22/853be10f029bc013a333811f216ce9e3'></script>" width="300" height="250" frameborder="0" scrolling="no" style="border:0;overflow:hidden;"></iframe>`,

    // 300x250 Medium Rectangle (AFK Zone right bottom)
    "afk-right-2": `<iframe srcdoc="<style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style><script>atOptions = {'key' : '853be10f029bc013a333811f216ce9e3','format' : 'iframe','height' : 250,'width' : 300,'params' : {}};</script><script src='https://bauval.org/22/853be10f029bc013a333811f216ce9e3'></script>" width="300" height="250" frameborder="0" scrolling="no" style="border:0;overflow:hidden;"></iframe>`
  }
};
