const CACHE = "fede-tracker-v63";
const FILES = [
  "./assets/exercises/upper-generic.svg",
  "./assets/exercises/power-generic.svg",
  "./assets/exercises/mobility-generic.svg",
  "./assets/exercises/back-extension-glute-bias.svg",
  "./assets/exercises/banded-clamshell.svg",
  "./assets/exercises/cable-lateral-raise-1-braccio.svg",
  "./assets/exercises/calf-raise.svg",
  "./assets/exercises/chest-supported-row.svg",
  "./assets/exercises/clamshell-con-manubrio.svg",
  "./assets/exercises/dumbbell-lateral-raise.svg",
  "./assets/exercises/dumbbell-overhead-press.svg",
  "./assets/exercises/frog-stand.svg",
  "./assets/exercises/glute-bridge-monopodalico.svg",
  "./assets/exercises/glute-bridge.svg",
  "./assets/exercises/incline-curl.svg",
  "./assets/exercises/l-sit.svg",
  "./assets/exercises/lat-pulldown-presa-stretta.svg",
  "./assets/exercises/lat-pulldown.svg",
  "./assets/exercises/leg-press-piedi-alti.svg",
  "./assets/exercises/machine-chest-press.svg",
  "./assets/exercises/machine-dip.svg",
  "./assets/exercises/machine-shoulder-press.svg",
  "./assets/exercises/nuoto.svg",
  "./assets/exercises/overhead-triceps-extension.svg",
  "./assets/exercises/pull-up.svg",
  "./assets/exercises/seated-cable-row.svg",
  "./assets/exercises/seated-leg-curl.svg",
  "./assets/exercises/single-arm-lat-pulldown.svg",
  "./assets/exercises/single-arm-row.svg",
  "./assets/exercises/stacco-sumo-con-manubrio.svg",
  "./assets/exercises/vacuum-addominale.svg",
  "./assets/exercises/photos/b-stance-rdl.jpg",
  "./assets/exercises/photos/back-extension-glute-bias.jpg",
  "./assets/exercises/photos/banded-clamshell.jpg",
  "./assets/exercises/photos/barbell-db-rdl.jpg",
  "./assets/exercises/photos/bayesian-cable-curl.jpg",
  "./assets/exercises/photos/belt-squat-sumo.jpg",
  "./assets/exercises/photos/bulgarian-split-squat.jpg",
  "./assets/exercises/photos/cable-crunch.jpg",
  "./assets/exercises/photos/cable-kickback.jpg",
  "./assets/exercises/photos/cable-lateral-raise-1-braccio.jpg",
  "./assets/exercises/photos/cable-lateral-raise.jpg",
  "./assets/exercises/photos/cable-pullover.jpg",
  "./assets/exercises/photos/cable-step-up.jpg",
  "./assets/exercises/photos/calf-raise.jpg",
  "./assets/exercises/photos/chest-supported-row.jpg",
  "./assets/exercises/photos/clamshell-con-manubrio.jpg",
  "./assets/exercises/photos/clamshell.jpg",
  "./assets/exercises/photos/core-cable-crunch.jpg",
  "./assets/exercises/photos/core-dead-bug.jpg",
  "./assets/exercises/photos/core-hanging-knee-raise.jpg",
  "./assets/exercises/photos/core-plank.jpg",
  "./assets/exercises/photos/core-vacuum-addominale.jpg",
  "./assets/exercises/photos/dead-bug.jpg",
  "./assets/exercises/photos/dumbbell-lateral-raise.jpg",
  "./assets/exercises/photos/frog-stand.jpg",
  "./assets/exercises/photos/glute-bridge-monopodalico.jpg",
  "./assets/exercises/photos/glute-bridge.jpg",
  "./assets/exercises/photos/hanging-knee-raise.jpg",
  "./assets/exercises/photos/hip-abduction-seated.jpg",
  "./assets/exercises/photos/hip-abduction.jpg",
  "./assets/exercises/photos/hip-adduction.jpg",
  "./assets/exercises/photos/hip-thrust-monopodalico-manubrio.jpg",
  "./assets/exercises/photos/incline-curl.jpg",
  "./assets/exercises/photos/kas-glute-bridge.jpg",
  "./assets/exercises/photos/l-sit.jpg",
  "./assets/exercises/photos/lat-pulldown-presa-stretta.jpg",
  "./assets/exercises/photos/lat-pulldown.jpg",
  "./assets/exercises/photos/leg-extension.jpg",
  "./assets/exercises/photos/leg-press-piedi-alti.jpg",
  "./assets/exercises/photos/machine-chest-press.jpg",
  "./assets/exercises/photos/machine-dip.jpg",
  "./assets/exercises/photos/machine-hip-thrust.jpg",
  "./assets/exercises/photos/machine-lateral-raise.jpg",
  "./assets/exercises/photos/machine-shoulder-press.jpg",
  "./assets/exercises/photos/manifest.json",
  "./assets/exercises/photos/military-press.jpg",
  "./assets/exercises/photos/monster-walk.jpg",
  "./assets/exercises/photos/nuoto.jpg",
  "./assets/exercises/photos/overhead-triceps-extension.jpg",
  "./assets/exercises/photos/pallof-press-anti-rotazione.jpg",
  "./assets/exercises/photos/pull-up.jpg",
  "./assets/exercises/photos/reverse-hyperextension.jpg",
  "./assets/exercises/photos/reverse-pec-deck-delt-post.jpg",
  "./assets/exercises/photos/seated-cable-row.jpg",
  "./assets/exercises/photos/seated-leg-curl.jpg",
  "./assets/exercises/photos/single-arm-lat-pulldown.jpg",
  "./assets/exercises/photos/single-arm-row.jpg",
  "./assets/exercises/photos/single-leg-leg-press.jpg",
  "./assets/exercises/photos/stacco-sumo-con-manubrio.jpg",
  "./assets/exercises/photos/vacuum-addominale.jpg",
  "./assets/exercises/photos/pull-up-hd.jpg",
  "./assets/exercises/photos/lat-pulldown-wide-hd.jpg",
  "./assets/exercises/photos/dumbbell-overhead-press-hd.jpg",
  "./assets/exercises/photos/face-pull.jpg",
  "./assets/exercises/photos/hip-thrust.jpg",
  "./assets/exercises/photos/reverse-lunge.jpg",
  "./assets/exercises/photos/step-up.jpg",
  "./assets/exercises/photos/triceps-cable-pushdown.jpg",
  "./assets/exercises/photos/ab-wheel.jpg",
  "./assets/exercises/photos/mountain-climbers.jpg",
  "./assets/exercises/photos/power-clean.jpg",
  "./assets/exercises/photos/squat-jump.jpg",
  "./assets/exercises/photos/scapular-pull-up.jpg",
  "./assets/exercises/photos/assisted-pull-up.jpg",
  "./assets/home/day1-back-shoulders.png",
  "./assets/home/day2-glutes-hamstrings.png",
  "./assets/home/day3-push-frogstand.png",
  "./assets/home/day4-glutes-lsit.png",
  "./assets/home/day5-quads-back.png",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// No automatic skipWaiting: an updated worker waits until the page has saved pending data and
// sends {type:'SKIP_WAITING'} (user tapped "Aggiorna"). A first install activates normally.
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }));
});
self.addEventListener("message", function(e){
  if(e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  const isNavigation=e.request.mode==='navigate'||(e.request.headers.get('accept')||'').includes('text/html');
  if(isNavigation){
    // Pages: network first, cached copy (or index.html) when offline.
    e.respondWith(fetch(e.request).then(function(res){ if(res&&res.ok)caches.open(CACHE).then(function(c){c.put(e.request,res.clone())}).catch(function(){}); return res; })
      .catch(function(){ return caches.match(e.request).then(function(r){ return r||caches.match('./index.html'); }); }));
    return;
  }
  // Assets: cache first, then network (cached for next time).
  e.respondWith(caches.match(e.request).then(function(cached){
    if(cached)return cached;
    return fetch(e.request).then(function(res){ if(res&&(res.ok||res.type==='opaque'))caches.open(CACHE).then(function(c){c.put(e.request,res.clone())}).catch(function(){}); return res; })
      .catch(function(){ return new Response('',{status:503}); });
  }));
});
