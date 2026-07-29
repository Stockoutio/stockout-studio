(function () {
  'use strict';

  // Email capture via Web3Forms — free, AJAX/CORS-friendly, no backend that pauses or nags.
  // Get a free access key (no account/dashboard) at https://web3forms.com and paste it below.
  // Until a real key is set, the form gracefully falls back to the mailto path.
  var WEB3FORMS_KEY = 'bc98bbb9-bba2-4a7b-8c98-9951aa9a19f9';


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
    cue.classList.add('show'); // spawns together with the title text
    window.addEventListener('scroll', function () { if (window.scrollY > window.innerHeight * 0.5) cue.classList.remove('show'); }, { passive: true });
  }

  // --- mobile nav dropdown ---
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function (e) { e.stopPropagation(); var open = navLinks.classList.toggle('open'); navToggle.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    navLinks.addEventListener('click', function () { navLinks.classList.remove('open'); navToggle.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('click', function (e) { if (!navLinks.contains(e.target) && e.target !== navToggle) { navLinks.classList.remove('open'); navToggle.setAttribute('aria-expanded', 'false'); } });
  }

  // --- death email: fill TIME SURVIVED from how far the visitor scrolled ---
  var emailSec = document.getElementById('email');
  if (emailSec && 'IntersectionObserver' in window) {
    var eio = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var tm = document.getElementById('perfTime');
        if (tm) { var max = document.documentElement.scrollHeight - window.innerHeight; var p = max > 0 ? Math.min(1, window.scrollY / max) : 1; tm.textContent = fmt(p * 1800); }
        eio.disconnect();
      });
    }, { threshold: 0.4 });
    eio.observe(emailSec);
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

  // --- THE DESCENT: Seedance legs scrubbed by scroll between destination stills ---
  var stageInner = document.getElementById('stageInner');
  var stageStill = document.getElementById('stageStill');
  var stageVideo = document.getElementById('stageVideo');
  var transits = [].slice.call(document.querySelectorAll('.transit[data-leg]'));
  var mobileLite = matchMedia('(max-width: 860px)').matches;
  var vidOK = !reduce && !mobileLite && !!(stageVideo && stageVideo.canPlayType && stageVideo.canPlayType('video/mp4'));
  // panel mode: rooms are pinned center-screen and glitch in/out instead of scrolling past
  var panelMode = !reduce && !mobileLite;
  var panels = [].slice.call(document.querySelectorAll('main .room-box'));
  if (panelMode && panels.length) document.documentElement.classList.add('panel-mode');
  // flight controls: wheel UP flies forward (you're flying INTO the building), smooth inertia.
  // Scrollbar + keyboard keep native direction; wheel over an open panel scrolls the panel.
  if (panelMode) {
    var cueEl = document.getElementById('scrollCue');
    if (cueEl) cueEl.innerHTML = 'SCROLL UP TO ENTER &#9650;';
    var sT = null, sOn = false;
    var sStep = function () {
      var cur = window.scrollY, d = sT - cur;
      if (Math.abs(d) < 0.6) { sOn = false; sT = null; return; }
      window.scrollTo(0, cur + d * 0.16);
      requestAnimationFrame(sStep);
    };
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return; // pinch/zoom
      if (e.target && e.target.closest && e.target.closest('.modal.open')) return;
      // only hand the wheel to a live panel that is GENUINELY scrollable (.scrolly)
      // and can still move that way — anything else is always flight input
      var lp = e.target && e.target.closest && e.target.closest('.room-box.live');
      if (lp && lp.scrollHeight > lp.clientHeight + 4) {
        var down = e.deltaY > 0;
        var atTop = lp.scrollTop <= 0, atBot = lp.scrollTop + lp.clientHeight >= lp.scrollHeight - 2;
        if ((down && !atBot) || (!down && !atTop)) return;
      }
      e.preventDefault();
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (sT === null || !sOn) sT = window.scrollY;
      sT = Math.max(0, Math.min(max, sT - e.deltaY)); // inverted: wheel up = fly forward
      if (!sOn) { sOn = true; requestAnimationFrame(sStep); }
    }, { passive: false });
  }
  // scroll-scrubbed CRT materialize: q 0 (dark) -> 1 (solid), fully reversible
  function panelPhase(el, q) {
    q = Math.max(0, Math.min(1, q));
    if (el._q !== undefined && Math.abs(el._q - q) < 0.004) return;
    el._q = q;
    var e = q * q * (3 - 2 * q); // smoothstep
    el.style.opacity = String(e);
    el.style.visibility = q > 0.02 ? 'visible' : 'hidden';
    el.style.pointerEvents = q > 0.94 ? 'auto' : 'none';
    if (q >= 0.998) {
      // fully materialized: clear every scrub effect so nothing clips at rest
      // (clip-path crops protruding bits — floor tags, hover lifts, glows — even with overflow visible)
      el.style.clipPath = 'none';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.filter = '';
    } else {
      var half = (1 - e) * 50; // clip iris opens from the center line
      var jit = (1 - e) * Math.sin(q * 43) * 9; // glitch jitter while unstable
      el.style.clipPath = 'inset(' + half.toFixed(2) + '% 0 ' + half.toFixed(2) + '% 0)';
      el.style.transform = 'translate(calc(-50% + ' + jit.toFixed(1) + 'px), -50%) scaleY(' + (0.55 + 0.45 * e).toFixed(3) + ')';
      el.style.filter = 'brightness(' + (1 + (1 - e) * 1.7).toFixed(2) + ')';
    }
    el.classList.toggle('live', q > 0.94);
  }
  function setPanels(n, q) { // stop n's panel gets q; every other panel goes dark
    var idx = n - 2;
    for (var i2 = 0; i2 < panels.length; i2++) panelPhase(panels[i2], i2 === idx ? q : 0);
  }
  // auto-fit: shrink any panel taller than the viewport window so nothing needs scrolling
  function fitPanels() {
    if (!panelMode) return;
    var avail = window.innerHeight * 0.84;
    for (var q = 0; q < panels.length; q++) {
      panels[q].style.zoom = '';
      panels[q].classList.remove('scrolly');
      var need = panels[q].scrollHeight;
      if (need > avail) {
        var k = avail / need;
        if (k < 0.55) { k = 0.55; panels[q].classList.add('scrolly'); } // extreme fallback only
        panels[q].style.zoom = String(k);
      }
    }
  }
  var zones = [], curStop = 1, activeLeg = 0;

  var outroTop = 0;
  function rebuildZones() {
    zones = transits.map(function (t) {
      var r = t.getBoundingClientRect();
      return { top: r.top + window.scrollY, h: Math.max(1, r.height), leg: +t.getAttribute('data-leg') };
    });
    var foot = document.querySelector('.foot');
    outroTop = foot ? foot.getBoundingClientRect().top + window.scrollY : 0;
  }
  // parked frames are the videos' OWN boundary frames, so still<->video joints are seamless
  function parkedSrc(n) { return n <= 1 ? 'media/descent/leg1-first.jpg' : 'media/descent/leg' + (n - 1) + '-last.jpg'; }
  function showStill(n) {
    if (curStop !== n) { curStop = n; stageStill.src = parkedSrc(n); }
    stageStill.classList.add('on');
    if (stageVideo) stageVideo.classList.remove('on');
  }
  var stageStillB = document.getElementById('stageStillB');
  function bridge(o, src) { // departure crossfade: arrival frame -> next leg's first frame
    if (!stageStillB) return;
    if (src && stageStillB._src !== src) { stageStillB._src = src; stageStillB.src = src; }
    stageStillB.style.opacity = String(o);
  }
  var cutFlash = document.getElementById('cutFlash');
  function flash() { // CRT re-sync burst that hides the camera-angle cut between legs
    if (!cutFlash || reduce) return;
    cutFlash.classList.remove('go'); void cutFlash.offsetWidth; cutFlash.classList.add('go');
  }
  // The flight must LAND: glide the playhead to its exact boundary frame before any
  // still handoff — abandoning it mid-clip is a visible jump-cut.
  function videoBusy(target) {
    var cur = stageVideo.currentTime || 0;
    if (tick._s === undefined) tick._s = cur;
    if (Math.abs(cur - target) <= 0.045 && !stageVideo.seeking) return false;
    tick._s += (target - tick._s) * 0.16;
    if (Math.abs(target - tick._s) < 0.012) tick._s = target;
    if (!stageVideo.seeking && Math.abs(cur - tick._s) > 0.012) stageVideo.currentTime = tick._s;
    return true;
  }
  function ensureLeg(n) {
    if (!vidOK || activeLeg === n) return;
    activeLeg = n;
    stageVideo.src = 'media/descent/leg' + n + '.mp4';
    stageVideo.load();
  }
  // Rate-servo scrub: the video PLAYS to chase the scroll-mapped time (smooth decode
  // through sparse keyframes); it only hard-seeks on reversals. Self-ticks while chasing.
  var ticking = false;
  function tick() {
    if (!zones.length) { ticking = false; return; }
    var mid = window.scrollY + window.innerHeight * 0.5, z = null, p = 0, i;
    for (i = 0; i < zones.length; i++) { if (mid >= zones[i].top && mid < zones[i].top + zones[i].h) { z = zones[i]; p = (mid - zones[i].top) / zones[i].h; break; } }
    if (!z) {
      // parked at a destination: show its still, pre-warm the next leg when close
      var n = 1;
      for (i = 0; i < zones.length; i++) if (mid >= zones[i].top + zones[i].h) n = zones[i].leg + 1;
      if (panelMode) {
        // parked: floor panel solid — except at the bottom, where the HR panel
        // dissolves out as the B1 footer (the in-flow finale) rises to replace it
        if (n === 8 && outroTop) setPanels(8, Math.max(0, Math.min(1, (outroTop - mid) / (window.innerHeight * 0.55))));
        else setPanels(n, 1);
      }
      if (vidOK && stageVideo.classList.contains('on') && stageVideo.readyState >= 2 && stageVideo.duration) {
        var lt = (activeLeg === n - 1) ? Math.max(0.001, stageVideo.duration - 0.05) : 0.001;
        if (videoBusy(lt)) { requestAnimationFrame(tick); return; } // finish landing before parking
      }
      showStill(n);
      bridge(0);
      for (i = 0; i < zones.length; i++) if (zones[i].top > mid && zones[i].top - mid < window.innerHeight * 1.3) { ensureLeg(zones[i].leg); break; }
      ticking = false; return;
    }
    // transit = three scroll phases: panel scrubs OUT (frame holds) -> flight -> next panel scrubs IN
    var OUT_END = 0.16, IN_START = 0.84;
    if (p < OUT_END) {
      if (panelMode) setPanels(z.leg, 1 - p / OUT_END);
      if (vidOK && activeLeg === z.leg && stageVideo.classList.contains('on') && stageVideo.readyState >= 2 && stageVideo.duration) {
        if (videoBusy(0.001)) { requestAnimationFrame(tick); return; } // rewind the flight to its first frame first
      }
      showStill(z.leg);
      ensureLeg(z.leg); // out-phase doubles as buffer time for the upcoming leg
      if (z.leg === 1) {
        bridge(0); // 1->2 angles mismatch too hard to blend: flash-masked cut
        if (vidOK && tick._ph === 'f1') flash();
      } else {
        bridge(Math.min(1, p / OUT_END), 'media/descent/leg' + z.leg + '-first.jpg'); // crossfade as before
      }
      tick._ph = 'o' + z.leg;
      ticking = false; return;
    }
    if (p > IN_START) {
      if (panelMode) setPanels(z.leg + 1, (p - IN_START) / (1 - IN_START));
      if (vidOK && activeLeg === z.leg && stageVideo.classList.contains('on') && stageVideo.readyState >= 2 && stageVideo.duration) {
        if (videoBusy(Math.max(0.001, stageVideo.duration - 0.05))) { requestAnimationFrame(tick); return; } // land on the exact final frame first
      }
      showStill(z.leg + 1);
      bridge(0);
      ticking = false; return;
    }
    if (panelMode) setPanels(0, 0); // mid-flight: all panels dark
    bridge(0);
    if (vidOK && z.leg === 1 && tick._ph === 'o1') flash(); // 1->2 only: mask the angle-cut
    tick._ph = 'f' + z.leg;
    var pf = (p - OUT_END) / (IN_START - OUT_END);
    if (!vidOK) { showStill(pf < 0.5 ? z.leg : z.leg + 1); ticking = false; return; } // stills-only mode
    ensureLeg(z.leg);
    if (stageVideo.readyState >= 2 && stageVideo.duration) {
      stageVideo.classList.add('on'); stageStill.classList.remove('on');
      var d = stageVideo.duration;
      var t = Math.min(d - 0.04, Math.max(0, pf * d));
      // momentum: ease a virtual playhead toward the scroll-mapped time (all-intra
      // encode makes each eased seek instant, so the glide renders smoothly)
      if (tick._leg !== z.leg || Math.abs(t - tick._s) > 1.5) { tick._leg = z.leg; tick._s = t; } // snap on leg change / anchor jumps
      tick._s += (t - tick._s) * 0.09;
      if (Math.abs(t - tick._s) < 0.006) tick._s = t;
      if (!stageVideo.seeking && Math.abs((stageVideo.currentTime || 0) - tick._s) > 0.012) stageVideo.currentTime = tick._s;
      if (tick._s !== t || stageVideo.seeking) { requestAnimationFrame(tick); return; } // keep gliding until converged
    } else {
      showStill(pf < 0.5 ? z.leg : z.leg + 1); // clip not buffered yet: hold the nearer still
    }
    if (stageVideo.seeking) { requestAnimationFrame(tick); return; } // apply the latest target once this seek lands
    ticking = false;
  }
  function kick() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
  if (stageStill && transits.length) {
    // the descent always begins at the surface: no mid-journey scroll restoration
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    if (!location.hash) window.scrollTo(0, 0);
    for (var si = 1; si <= 7; si++) { var pa = new Image(); pa.src = 'media/descent/leg' + si + '-first.jpg'; var pb = new Image(); pb.src = 'media/descent/leg' + si + '-last.jpg'; }
    // panel content images can land late — re-measure the fit when they do
    panels.forEach(function (pl) {
      [].slice.call(pl.querySelectorAll('img')).forEach(function (im) {
        if (!im.complete) im.addEventListener('load', function () { fitPanels(); }, { once: true });
      });
    });
    window.addEventListener('scroll', function () {
      kick();
      // keep offering the score on scroll: succeeds the moment the browser permits audio
      if (ost && ost.paused && !ostUserOff) { var onw = Date.now(); if (!ostKicked || onw - ostKicked > 1200) { ostKicked = onw; ostStart(); } }
    }, { passive: true });
    window.addEventListener('resize', function () { rebuildZones(); fitPanels(); });
    window.addEventListener('load', function () { rebuildZones(); fitPanels(); kick(); });
    setTimeout(function () { rebuildZones(); fitPanels(); kick(); }, 250);
  }
  // cursor parallax on the cinema stage (desktop, motion allowed)
  if (vidOK && stageInner) {
    var mx = 0, my = 0, mtx = 0, mty = 0, mPend = false;
    var mstep = function () {
      mx += (mtx - mx) * 0.1; my += (mty - my) * 0.1;
      stageInner.style.transform = 'scale(1.06) translate(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px)';
      if (Math.abs(mtx - mx) > 0.15 || Math.abs(mty - my) > 0.15) requestAnimationFrame(mstep); else mPend = false;
    };
    window.addEventListener('pointermove', function (e) {
      mtx = (e.clientX / window.innerWidth - 0.5) * -18;
      mty = (e.clientY / window.innerHeight - 0.5) * -12;
      if (!mPend) { mPend = true; requestAnimationFrame(mstep); }
    }, { passive: true });
  }
  // OST: starts with the descent scroll (when the browser allows it); ♪ button is the
  // always-visible kill switch. An explicit OFF is remembered and never auto-overridden.
  // NOTE: must start AUDIBLE — the play-silent-then-ramp trick gets silently muted by
  // autoplay policy. The button label follows the element's real play/pause events.
  var ost = document.getElementById('ost'), ostBtn = document.getElementById('ostToggle');
  var ostKicked = false, ostArmed = false, ostUserOff = false;
  try { ostUserOff = localStorage.getItem('stockout_ost') === 'off'; } catch (e) {}
  function ostPaint(on) { if (ostBtn) { ostBtn.textContent = '♪ OST: ' + (on ? 'ON' : 'OFF'); ostBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); } }
  function ostArm() { // browser wants a real gesture: start on the first click/keypress
    if (ostArmed) return; ostArmed = true;
    var h = function (e) {
      window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h);
      ostArmed = false;
      // gestures on the ♪ button itself don't auto-start — its own click handler decides,
      // otherwise pointerdown starts the track and the click immediately re-pauses it
      if (e && e.target && e.target.closest && e.target.closest('#ostToggle')) return;
      if (!ostUserOff && ost.paused) { ost.volume = 0.6; ost.play().catch(function () {}); }
    };
    window.addEventListener('pointerdown', h); window.addEventListener('keydown', h);
  }
  function ostStart() {
    if (!ost || ostUserOff || !ost.paused) return;
    ost.volume = 0.6;
    var pr = ost.play();
    if (pr && pr.catch) pr.catch(ostArm);
  }
  if (ost && ostBtn) {
    ost.addEventListener('play', function () { ostPaint(true); });
    ost.addEventListener('pause', function () { ostPaint(false); });
    ostBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (ost.paused) {
        ostUserOff = false; try { localStorage.setItem('stockout_ost', 'on'); } catch (err) {}
        ost.volume = 0.6; ost.play().catch(function () {});
      } else {
        ostUserOff = true; try { localStorage.setItem('stockout_ost', 'off'); } catch (err) {}
        ost.pause();
      }
    });
  }

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

  // --- notify modal (email capture via Web3Forms, mailto fallback) ---
  var modal = document.getElementById('notifyModal');
  var form = document.getElementById('notifyForm');
  var emailInput = document.getElementById('notifyEmail');
  var okBox = document.getElementById('notifyOk');
  var lastFocus = null;
  function openModal() { if (!modal) return; lastFocus = document.activeElement; modal.classList.add('open'); if (emailInput) setTimeout(function () { emailInput.focus(); }, 30); }
  function closeModal() { if (!modal) return; modal.classList.remove('open'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  document.querySelectorAll('[data-notify]').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
  });

  if (modal) {
    document.getElementById('notifyClose').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
    modal.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !modal.classList.contains('open')) return;
      var f = [].slice.call(modal.querySelectorAll('button, input, a[href]')).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }, true);
  }

  function subscribe(email) {
    if (!WEB3FORMS_KEY || WEB3FORMS_KEY === 'YOUR-ACCESS-KEY-HERE') return Promise.resolve(false); // not configured -> mailto fallback
    return fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: 'New SCRUMBAG notify signup', from_name: 'stockout.studio', email: email, source: 'site' })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (emailInput.value || '').trim();
      if (!email) return;
      form.style.display = 'none';
      okBox.style.display = 'block';
      okBox.textContent = 'PROCESSING…';
      subscribe(email).then(function (ok) {
        if (ok) {
          okBox.innerHTML = "YOU'RE ON THE PIPELINE.<br />We'll email you one death-email when the shift opens.";
          confetti(window.innerWidth / 2, window.innerHeight * 0.4);
        } else {
          okBox.innerHTML = "ALMOST &mdash; the list is warming up.<br />Mail us directly to lock your spot: <a href='mailto:stockoutgames@pm.me?subject=Notify%20me%20about%20SCRUMBAG'>stockoutgames@pm.me</a>";
        }
        if (okBox.focus) okBox.focus();
      });
    });
  }

  // --- alpha feedback form (Web3Forms, same key; mailto fallback) ---
  var fform = document.getElementById('feedbackForm');
  if (fform) {
    fform.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = (document.getElementById('feedbackMsg').value || '').trim();
      if (!msg) return;
      var em = (document.getElementById('feedbackEmail').value || '').trim();
      var fok = document.getElementById('feedbackOk');
      fform.style.display = 'none'; fok.style.display = 'block'; fok.textContent = 'FILING…';
      sendFeedback(msg, em).then(function (ok) {
        if (ok) {
          fok.innerHTML = "REPORT FILED.<br />HR has logged your incident. Thanks for the labor.";
          confetti(window.innerWidth / 2, window.innerHeight * 0.5);
        } else {
          fok.innerHTML = "COULDN'T REACH HR &mdash; email it directly: <a href='mailto:stockoutgames@pm.me?subject=SCRUMBAG%20alpha%20feedback'>stockoutgames@pm.me</a>";
        }
        if (fok.focus) fok.focus();
      });
    });
  }
  function sendFeedback(message, email) {
    if (!WEB3FORMS_KEY || WEB3FORMS_KEY === 'YOUR-ACCESS-KEY-HERE') return Promise.resolve(false);
    var payload = { access_key: WEB3FORMS_KEY, subject: 'SCRUMBAG alpha feedback', from_name: 'stockout.studio', message: message, source: 'alpha-feedback' };
    if (email) payload.email = email;
    return fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  // Robustness net: reveal sections even if IntersectionObserver misbehaves.
  function fallbackScan() {
    var vh = window.innerHeight;
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('in'); });
  }
  window.addEventListener('scroll', fallbackScan, { passive: true });
  window.addEventListener('load', fallbackScan);
  fallbackScan();
})();
