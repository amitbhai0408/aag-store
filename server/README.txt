AAG SMP - Database server
=========================

Ye kya karta hai
- Login karne wale users ka Minecraft username (aur Java/Bedrock) save karta hai.
- AFK Zone ke minutes count karta hai.
- Code Links ka system chalata hai: user link se code leta hai, phir Redeem karta hai.
- Redeem hue rewards "pending" list me jaate hain (baad me in-game plugin yaha se leke reward dega).
- Data `data/users.json` aur `data/codes.json` me rehta hai.

Chalane ka tareeka
1. Node.js install karo (version 18 ya naya): https://nodejs.org
2. Is `server` folder me terminal kholo aur chalao:
       node server.js
   Admin password ke saath (Windows):  set ADMIN_KEY=meraPassword && node server.js
3. `store.aagmc.fun/config.js` me apna server ka address daalo:
       apiUrl: "http://localhost:3000"
   Live website ke liye ye server kisi VPS/hosting par chalana hoga aur apiUrl me uska
   https address dena hoga (jaise https://api.aagmc.fun).

Settings (environment variables)
- PORT          port (default 3000)
- ALLOW_ORIGIN  apni website ka address, jaise https://aagmc.fun (live karte waqt zaroor set karo)
- ADMIN_KEY     admin password (iske bina niche wale admin links band rahte hain)

Code Links kaise kaam karte hain
1. User Free Redeem Codes page par "Get Code" dabata hai -> server note karta hai ki usne link shuru ki.
2. User aapke ad-gateway/shortener se guzarta hai. Uska last destination:
       https://aagmc.fun/store.aagmc.fun/claim.html?l=link1      (link1, link2, ... jo link ho)
   (Aapki site jis address par ho, wahi lagana. Page ka naam claim.html hai.)
3. claim.html server se code leta hai (jaise AAG-AB12-CD34). Server kam se kam 30 second ka gap
   maangta hai (config.json -> claimMinSeconds), warna code nahi deta.
4. User wo code Free Redeem Codes page par daal ke "Redeem" dabata hai. Code sirf usi user ka hota hai,
   ek hi baar chalta hai aur 24 ghante me expire ho jaata hai.
5. Redeem hone par reward "pending" me chala jaata hai.

Links aur rewards badalna: config.json
- "links" me har link ka naam, cooldownMinutes (ek user wo link dobara kitni der baad le sakta hai)
  aur reward ka label hai. Abhi label "Reward to be announced" hai, wahi badalna.
- Naya link add karna ho to config.json me aur `free-redeem-codes.html` ke LINKS me ek jaisa id daalo.

Admin links (ADMIN_KEY chahiye)
- Users ki list:       GET  /api/users?key=<ADMIN_KEY>
- Pending rewards:     GET  /api/pending?key=<ADMIN_KEY>
- Reward de diya:      POST /api/delivered   (header X-Admin-Key, body {"ids":["...","..."]})
  Aapka Minecraft plugin /api/pending se list leke reward dega, phir /api/delivered se mark karega.

Dhyan rakhne wali baatein
- Login sirf username se hai, password nahi. Koi bhi kisi ka bhi username daal sakta hai.
  Reward usi naam ko milta hai, isliye reward ke liye theek hai, par private cheezon ke liye nahi.
- Ad-gateway ko log "bypass" kar sakte hain (seedha claim.html kholne ki koshish). Server ye rokta hai
  ki pehle Code Link shuru ki ho aur 30 second guzre ho, lekin pakka bypass-protection ke liye
  shortener ki API (jo har user ke liye alag link banati hai) use karni padegi.
- Ye chhota server hai. Hazaaron users hone par asli database (SQLite/MySQL/Postgres) par jana.
