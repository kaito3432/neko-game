const CACHE_NAME = "nyan-chase-v82-room-review-20261011";
const PRECACHE = [
  "./release-features.js",
  "./skill-catalog.js",
  "./api-environment.js",
  "./monetization-products.js",
  "./monetization.js",
  "./monetization-ui.js",
  "./ad-config.js",
  "./ad-consent.js",
  "./rewarded-ad-provider.js",
  "./rewarded-ad-ui.js",
  "./storekit-provider.js",
  "./google-play-provider.js",
  "./purchase-provider.js",
  "./store-ui-model.js",
  "./storekit-ui.js",
  "./cpu-unlock-sync.js",
  "./online-identity.js",
  "./online-delete-ui.js",
  "./legal-pages.js",
  "./legal.css",
  "./privacy.html",
  "./terms.html",
  "./support.html",
  "./data-deletion.html",
  "./online-appearance.js",
  "./in-app-review.js",
  "./random-match.js",
  "./rank-rewards.js",
  "./ranked-ui.js",
  "./ranked-stamina-ui.js",
  "./result-presentation.js",
  "./online-profile-ui.js",
  "./",
  "./animation.js",
  "./assets/audio/bgm_game.wav",
  "./assets/audio/bgm_home.wav",
  "./assets/audio/bgm_tension.wav",
  "./assets/audio/jingle_cat_win.wav",
  "./assets/audio/jingle_police_win.wav",
  "./assets/audio/se_button_tap.wav",
  "./assets/audio/se_capture.wav",
  "./assets/audio/se_footprint_found.wav",
  "./assets/audio/se_game_start.wav",
  "./assets/audio/se_invalid.wav",
  "./assets/audio/se_move.wav",
  "./assets/audio/se_search.wav",
  "./assets/audio/se_turn_change.wav",
  "./assets/images/bg_day.png",
  "./assets/images/board-blocked/day-planter.svg",
  "./assets/images/board-blocked/day-sign.svg",
  "./assets/images/board-blocked/moon-stone-lantern.svg",
  "./assets/images/board-blocked/moon-andon.svg",
  "./assets/images/box.png",
  "./assets/images/cat.png",
  "./assets/images/cutin_cat_win.jpg",
  "./assets/images/cutin_police_win.jpg",
  "./assets/images/default_cat_result_lose.png",
  "./assets/images/default_dog_result_lose.png",
  "./assets/images/cat_play_action.png",
  "./assets/images/cat_play_alert.png",
  "./assets/images/cat_play_normal.png",
  "./assets/images/cpu_select_cat.png",
  "./assets/images/cpu_select_dogs.png",
  "./assets/images/dog_blue.png",
  "./assets/images/dog_default_profile.png",
  "./assets/images/dog_blue_play.png",
  "./assets/images/dog_card_blue.png",
  "./assets/images/dog_card_green.png",
  "./assets/images/dog_card_red.png",
  "./assets/images/dog_green.png",
  "./assets/images/dog_green_play.png",
  "./assets/images/dog_red.png",
  "./assets/images/dog_red_play.png",
  "./assets/images/home_cpu.png",
  "./assets/images/home_hero.png",
  "./assets/images/home_logo.png",
  "./assets/images/home_vs.png",
  "./assets/images/logo.png",
  "./assets/images/paw.png",
  "./assets/images/pwa/apple-touch-icon.png",
  "./assets/images/pwa/icon-192.png",
  "./assets/images/pwa/icon-512.png",
  "./assets/images/pwa/icon-maskable-512.png",
  "./assets/images/start.png",
  "./assets/images/skins/mystery01/cat_kaitou_collection_locked.png",
  "./assets/images/skins/mystery01/cat_kaitou_profile_locked.png",
  "./assets/images/skins/mystery01/dog_detective_collection_locked.png",
  "./assets/images/skins/mystery01/dog_detective_profile_locked.png",
  "./assets/images/skins/ninja01/cat_ninja_collection.png",
  "./assets/images/skins/ninja01/cat_ninja_profile.png",
  "./assets/images/skins/ninja01/cat_ninja_piece.png",
  "./assets/images/skins/ninja01/cat_ninja_result_win.png",
  "./assets/images/skins/ninja01/cat_ninja_result_lose.png",
  "./assets/images/skins/ninja01/cat_ninja_effect_smoke.png",
  "./assets/images/skins/ninja01/cat_ninja_effect_found.png",
  "./assets/images/skins/ninja01/cat_ninja_home_decor.png",
  "./assets/images/skins/ninja01/cat_ninja_home_character.png",
  "./assets/images/skins/ninja01/cat_ninja_home.png",
  "./assets/images/skins/ninja01/dog_samurai_collection.png",
  "./assets/images/skins/ninja01/dog_samurai_profile.png",
  "./assets/images/skins/ninja01/dog_samurai_red_piece.png",
  "./assets/images/skins/ninja01/dog_samurai_black_piece.png",
  "./assets/images/skins/ninja01/dog_samurai_white_piece.png",
  "./assets/images/skins/ninja01/dog_samurai_result_win.png",
  "./assets/images/skins/ninja01/dog_samurai_result_lose.png",
  "./assets/images/skins/ninja01/dog_samurai_effect_slash.png",
  "./assets/images/skins/ninja01/dog_samurai_effect_found.png",
  "./assets/images/skins/ninja01/dog_samurai_home_decor.png",
  "./assets/images/skins/ninja01/dog_samurai_home_character.png",
  "./assets/images/skins/ninja01/dog_samurai_home.png",
  "./assets/images/cosmetics/japanese01/cardboard_ninja_crate.png",
  "./assets/images/cosmetics/japanese01/paw_sumi.png",
  "./assets/images/cosmetics/japanese01/board_moonlit_castle_town.png",
  "./assets/images/rank/profile-frames/rank_bronze_frame.png",
  "./assets/images/rank/profile-frames/rank_silver_frame.png",
  "./assets/images/rank/profile-frames/rank_gold_frame.png",
  "./assets/images/rank/profile-frames/rank_platinum_frame.png",
  "./assets/images/rank/profile-frames/rank_diamond_frame.png",
  "./assets/images/rank/profile-frames/rank_master_frame.png",
  "./audio.js",
  "./collection-catalog.js",
  "./debug/board-theme-qa.js",
  "./collection.js",
  "./engine.js",
  "./police-hard-ai.js",
  "./game.js",
  "./index.html",
  "./manifest.webmanifest",
  "./player-data.js",
  "./progression-model.js",
  "./daily-missions.js",
  "./skin-presentation.js",
  "./style.css"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: preserve each legal page in its own cache slot.
  if (req.mode === "navigate") {
    const page = url.pathname.split("/").pop();
    const cacheKey = ["privacy.html", "terms.html", "support.html", "data-deletion.html"].includes(page)
      ? `./${page}` : "./index.html";
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, copy));
          }
          return res;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  // Core rule files must refresh with each release, including a MAX_TURNS-only
  // change; retain the cached copy solely for offline fallback.
  if (["engine.js", "game.js", "police-hard-ai.js"].includes(url.pathname.split("/").pop())) {
    event.respondWith(fetch(req).then(res => {
      if (res?.ok) {
        const copy=res.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
      }
      return res;
    }).catch(()=>caches.match(req,{ignoreSearch:true})));
    return;
  }

  // Static assets: cached first, then network and refresh cache.
  event.respondWith(
    caches.match(req, {ignoreSearch:true})
      .then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }))
  );
});
