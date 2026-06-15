(function () {
  'use strict';

  var SUPABASE_URL = 'https://agbtvbymknayxrebochn.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_8yipwhYLiM19LVR8qLXT6A_MOD1YTl1';

  var STEAM_APPID = '0000000';
  function steamUrl(campaign) {
    if (STEAM_APPID === '0000000') return null;
    return 'https://store.steampowered.com/app/' + STEAM_APPID + '/Scrumbag/?utm_source=stockout_studio&utm_campaign=' + campaign;
  }

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- scroll reveals ---
  var revEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revEls.forEach(function (el) { ro.observe(el); });
  } else {
    revEls.forEach(function (el) { el.classList.add('in'); });
  }

  // --- roster flip cards ---
  document.querySelectorAll('[data-flip]').forEach(function (card) {
    function toggle() { var f = card.classList.toggle('flipped'); card.setAttribute('aria-pressed', f ? 'true' : 'false'); }
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  // --- scroll cue (affordance that there's more below) ---
  var cue = document.getElementById('scrollCue');
  if (cue) {
    setTimeout(function () { cue.classList.add('show'); }, 1400);
    window.addEventListener('scroll', function () { if (window.scrollY > 60) cue.classList.remove('show'); }, { passive: true });
  }

  // --- scroll-driven session clock + footer termination flip ---
  var clocks = document.querySelectorAll('[data-clock]');
  var footClock = document.getElementById('footClock');
  function fmt(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  var clockRAF = false;
  function updateClock() {
    clockRAF = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    var t = p * 1800;
    clocks.forEach(function (c) { c.textContent = fmt(t); });
    if (footClock) {
      if (p > 0.96) { footClock.classList.add('term'); footClock.textContent = 'HR TERMINATION INBOUND'; }
      else { footClock.classList.remove('term'); footClock.textContent = 'SESSION ' + fmt(t) + ' / 30:00'; }
    }
  }
  window.addEventListener('scroll', function () { if (!clockRAF) { clockRAF = true; requestAnimationFrame(updateClock); } }, { passive: true });
  updateClock();

  // --- FX canvas: click bursts + confetti (echoes the game's juice) ---
  var fx = document.getElementById('fxCanvas');
  var fctx = fx ? fx.getContext('2d') : null;
  var fdpr = Math.min(2, window.devicePixelRatio || 1);
  var items = [], fxRunning = false, fxLast = 0;
  function fxResize() { if (!fx) return; fx.width = Math.round(innerWidth * fdpr); fx.height = Math.round(innerHeight * fdpr); fx.style.width = innerWidth + 'px'; fx.style.height = innerHeight + 'px'; fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0); }
  if (fx) { fxResize(); window.addEventListener('resize', fxResize); }
  function fxStart() { if (fxRunning || reduce || !fctx) return; fxRunning = true; fxLast = 0; requestAnimationFrame(fxFrame); }
  function fxFrame(now) {
    var d = Math.min(0.05, (now - (fxLast || now)) / 1000); fxLast = now;
    fctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (it.t === 'ring') {
        it.life -= d * 2.8; if (it.life <= 0) { items.splice(i, 1); continue; }
        it.r += (it.max - it.r) * d * 6;
        fctx.globalAlpha = Math.max(0, it.life) * 0.8; fctx.strokeStyle = it.c; fctx.lineWidth = 2 * it.life;
        fctx.beginPath(); fctx.arc(it.x, it.y, it.r, 0, 6.28); fctx.stroke(); fctx.globalAlpha = 1;
      } else {
        it.vy += (it.g || 0) * d; it.vx *= (1 - (it.decel || 0) * d);
        it.x += it.vx * d; it.y += it.vy * d; it.life -= d / (it.dur || 0.6);
        if (it.life <= 0) { items.splice(i, 1); continue; }
        fctx.globalAlpha = it.fade === 'sine' ? Math.sin(Math.max(0, it.life) * Math.PI) : Math.max(0, it.life);
        fctx.fillStyle = it.c;
        if (it.rect) { fctx.save(); fctx.translate(it.x, it.y); fctx.rotate(it.rot += (it.spin || 0) * d); fctx.fillRect(-it.s / 2, -it.s / 2, it.s, it.s); fctx.restore(); }
        else { fctx.fillRect(it.x - it.s / 2, it.y - it.s / 2, it.s, it.s); }
        fctx.globalAlpha = 1;
      }
    }
    if (items.length) requestAnimationFrame(fxFrame); else fxRunning = false;
  }
  function burst(x, y, color) {
    if (reduce || !fctx) return;
    for (var k = 0; k < 16; k++) { var a = (k / 16) * 6.28 + Math.random() * 0.4, sp = 200 + Math.random() * 220; items.push({ t: 'p', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 3 + Math.random() * 3, c: color, life: 1, dur: 0.4 + Math.random() * 0.28, decel: 0.6 }); }
    items.push({ t: 'ring', x: x, y: y, r: 14, max: 110, life: 1, c: color });
    fxStart();
  }
  function confetti(x, y) {
    if (reduce || !fctx) return;
    var cols = ['#ffd866', '#33ccff', '#ff2233', '#00ffaa', '#ff88cc', '#e8fff5'];
    for (var k = 0; k < 110; k++) { var a = Math.random() * 6.28, sp = 240 + Math.random() * 320; items.push({ t: 'p', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (60 + Math.random() * 90), g: 360 + Math.random() * 180, s: 5 + Math.random() * 6, c: cols[k % cols.length], life: 1, dur: 1.0 + Math.random() * 1.1, fade: 'sine', rect: Math.random() < 0.6, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 8 }); }
    fxStart();
  }
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest ? e.target.closest('.cmd') : null;
    if (b) burst(e.clientX, e.clientY, b.classList.contains('ghostbtn') ? '#00ffaa' : '#ff2233');
  });

  // --- notify modal (email capture via Supabase, mailto fallback) ---
  var modal = document.getElementById('notifyModal');
  var form = document.getElementById('notifyForm');
  var emailInput = document.getElementById('notifyEmail');
  var okBox = document.getElementById('notifyOk');
  var lastFocus = null;
  function openModal() { if (!modal) return; lastFocus = document.activeElement; modal.classList.add('open'); if (emailInput) setTimeout(function () { emailInput.focus(); }, 30); }
  function closeModal() { if (!modal) return; modal.classList.remove('open'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  function wireCTAs() {
    var url = steamUrl('cta');
    document.querySelectorAll('[data-notify]').forEach(function (btn) {
      if (url) {
        var a = document.createElement('a');
        a.className = btn.className; a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = btn.innerHTML.replace(/GET NOTIFIED( FOR SCRUMBAG)?|REPLY: NOTIFY ME|ADD ME TO THE PIPELINE/i, 'WISHLIST ON STEAM');
        btn.parentNode.replaceChild(a, btn);
      } else {
        btn.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
      }
    });
  }
  wireCTAs();

  if (modal) {
    document.getElementById('notifyClose').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
  }

  function subscribe(email) {
    return fetch(SUPABASE_URL + '/rest/v1/subscribers', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return-minimal' },
      body: JSON.stringify({ email: email, source: 'site' })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (emailInput.value || '').trim();
      if (!email) return;
      form.style.display = 'none';
      subscribe(email).then(function (ok) {
        okBox.style.display = 'block';
        if (ok) {
          okBox.innerHTML = "YOU'RE ON THE PIPELINE.<br />We'll email you one death-email when the shift opens.";
          confetti(window.innerWidth / 2, window.innerHeight * 0.4);
        } else {
          okBox.innerHTML = "ALMOST &mdash; the list is warming up.<br />Mail us directly to lock your spot: <a href='mailto:stockoutgames@pm.me?subject=Notify%20me%20about%20SCRUMBAG'>stockoutgames@pm.me</a>";
        }
      });
    });
  }

  // --- lazy AD-BIRD-TISING loader (preserves the existing Supabase ad-fetch + AdBird init) ---
  var gwLoaded = false;
  function injectScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = function () { res(); }; s.onerror = function () { rej(new Error(src)); }; document.body.appendChild(s); });
  }
  function bootGridwing() {
    if (gwLoaded) return; gwLoaded = true;
    var canvas = document.getElementById('adBirdCanvas');
    var ph = document.getElementById('gwPlaceholder');
    injectScript('ad-bird-content.js').then(function () { return injectScript('ad-bird.js'); }).then(function () {
      var paidAds = [];
      return fetch(SUPABASE_URL + '/rest/v1/ads?select=text&is_paid=eq.true&status=eq.approved&expires_at=gt.now()', {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
      }).then(function (r) { return r.ok ? r.json() : []; }).then(function (data) {
        var colors = ['#a855f7', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899', '#f43f5e'];
        paidAds = (data || []).map(function (ad) { return Object.assign({}, ad, { isPaid: true, color: ad.color || colors[Math.floor(Math.random() * colors.length)] }); });
      }).catch(function () { /* backend optional */ }).then(function () {
        if (typeof AdBird === 'undefined') { if (ph) ph.textContent = 'CABINET OFFLINE — reload to retry.'; gwLoaded = false; return; }
        if (ph) ph.style.display = 'none';
        if (canvas) canvas.style.display = 'block';
        window.adBirdGame = new AdBird('adBirdCanvas', { paidAds: paidAds });
      });
    }).catch(function (err) {
      gwLoaded = false;
      if (ph) ph.textContent = 'CABINET OFFLINE — reload to retry.';
      console.warn('AD-BIRD-TISING failed to load:', err);
    });
  }
  var gw = document.getElementById('adbirdBlock');
  if (gw && 'IntersectionObserver' in window) {
    var gio = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { bootGridwing(); gio.disconnect(); } }); }, { rootMargin: '250px' });
    gio.observe(gw);
  } else if (gw) {
    bootGridwing();
  }

  // Robustness net: ensure reveals + game boot fire even if IntersectionObserver misbehaves.
  function fallbackScan() {
    var vh = window.innerHeight;
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('in'); });
    if (gw && gw.getBoundingClientRect().top < vh + 250) bootGridwing();
  }
  window.addEventListener('scroll', fallbackScan, { passive: true });
  window.addEventListener('load', fallbackScan);
  fallbackScan();
})();
