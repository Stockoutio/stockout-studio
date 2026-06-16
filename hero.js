(function () {
  var cv = document.getElementById('heroCanvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var rev = document.getElementById('heroReveal');
  var playHint = document.getElementById('heroPlayHint');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHOS = '#00ffaa', DIM = '#00cc88', ALERT = '#ff2233', INK = '#e8fff5', GR = '#ff3366', GB = '#33ccff';
  var W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
  var overlay = document.createElement('canvas');
  var enemies = [], pellets = [], bursts = [], trail = [];
  var aim = { x: 0, y: 0 }, lastMove = -9999, kills = 0, startT = 0, flashAt = -9999;
  var revealed = false, ambient = false;
  var lastFire = 0, lastSpawn = 0, last = 0, running = false, runId = 0, started = false;
  var REVEAL_KILLS = 6, REVEAL_MS = 4000;

  function ff(px) { return px + 'px "PressStart", ui-monospace, monospace'; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function resize() {
    W = cv.clientWidth || cv.offsetWidth; H = cv.clientHeight || cv.offsetHeight;
    if (!W || !H) return;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!aim.x) { aim.x = W * 0.5; aim.y = H * 0.5; }
    buildOverlay();
  }
  function buildOverlay() {
    overlay.width = Math.round(W * DPR); overlay.height = Math.round(H * DPR);
    var o = overlay.getContext('2d'); o.setTransform(DPR, 0, 0, DPR, 0, 0); o.clearRect(0, 0, W, H);
    var g = o.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); o.fillStyle = g; o.fillRect(0, 0, W, H);
  }
  function spawn() {
    if (enemies.length > 40) return;
    var s = Math.floor(rnd(0, 4)), x, y;
    if (s === 0) { x = rnd(0, W); y = -20; } else if (s === 1) { x = rnd(0, W); y = H + 20; }
    else if (s === 2) { x = -20; y = rnd(0, H); } else { x = W + 20; y = rnd(0, H); }
    enemies.push({ x: x, y: y, type: Math.floor(rnd(0, 3)), r: 6, s: rnd(34, 60) });
  }
  function nearest(x, y) { var b = null, bd = 1e9; for (var i = 0; i < enemies.length; i++) { var e = enemies[i], d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y); if (d < bd) { bd = d; b = e; } } return b; }
  function explode(x, y) { var c = [PHOS, GR, GB, INK]; for (var k = 0; k < 7; k++) { var a = rnd(0, 6.28), sp = rnd(40, 150); bursts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: c[Math.floor(rnd(0, c.length))] }); } }
  function killAt(e) { var ix = enemies.indexOf(e); if (ix < 0) return; enemies.splice(ix, 1); explode(e.x, e.y); kills++; window.__heroKills = kills; }
  function drawEnemy(e) {
    if (e.type === 0) { ctx.fillStyle = ALERT; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.28); ctx.fill(); }
    else if (e.type === 1) { ctx.strokeStyle = GB; ctx.lineWidth = 2; ctx.strokeRect(e.x - 7, e.y - 5, 14, 10); ctx.fillStyle = GB; ctx.font = ff(6); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RE:', e.x, e.y + 1); }
    else { ctx.strokeStyle = DIM; ctx.lineWidth = 1.5; ctx.strokeRect(e.x - 6, e.y - 6, 12, 12); ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 6); ctx.lineTo(e.x, e.y); ctx.lineTo(e.x + 6, e.y - 6); ctx.stroke(); }
  }
  function path() { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 19); ctx.lineTo(5, 14); ctx.lineTo(9, 21); ctx.lineTo(12, 19.5); ctx.lineTo(8, 13); ctx.lineTo(14, 13); ctx.closePath(); }
  function arrow(x, y) {
    for (var i = 0; i < trail.length; i++) { var tp = trail[i]; ctx.globalAlpha = (i / trail.length) * 0.22; ctx.fillStyle = PHOS; ctx.fillRect(tp.x - 1.5, tp.y - 1.5, 3, 3); }
    ctx.globalAlpha = 1; ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = 0.5; ctx.fillStyle = GR; ctx.save(); ctx.translate(-2, 0); path(); ctx.fill(); ctx.restore();
    ctx.fillStyle = GB; ctx.save(); ctx.translate(2, 0); path(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    ctx.shadowColor = PHOS; ctx.shadowBlur = 10; ctx.fillStyle = PHOS; ctx.strokeStyle = '#003322'; ctx.lineWidth = 1; path(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore();
  }
  function drawBursts(d) { for (var b = bursts.length - 1; b >= 0; b--) { var br = bursts[b]; br.x += br.vx * d; br.y += br.vy * d; br.life -= d * 1.8; if (br.life <= 0) { bursts.splice(b, 1); continue; } ctx.globalAlpha = Math.max(0, br.life); ctx.fillStyle = br.c; ctx.fillRect(br.x - 2, br.y - 2, 4, 4); ctx.globalAlpha = 1; } }
  function doReveal() { if (revealed) return; revealed = true; ambient = true; if (rev) rev.classList.add('show'); if (playHint) playHint.style.display = 'none'; flashAt = performance.now(); }
  function step(now) {
    if (!startT) startT = now;
    var d = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (ambient || now - lastMove > 1200) { var t = now / 1000; aim.x = W * 0.5 + Math.cos(t * 0.7) * W * 0.30; aim.y = H * 0.5 + Math.sin(t * 1.05) * H * 0.32; }
    if (now - lastSpawn > 200) { lastSpawn = now; spawn(); }
    if (now - lastFire > 140) { lastFire = now; var tg = nearest(aim.x, aim.y); if (tg) { var a = Math.atan2(tg.y - aim.y, tg.x - aim.x); pellets.push({ x: aim.x, y: aim.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, life: 1.4 }); } }
    for (var i = enemies.length - 1; i >= 0; i--) { var e = enemies[i], a2 = Math.atan2(aim.y - e.y, aim.x - e.x); e.x += Math.cos(a2) * e.s * d; e.y += Math.sin(a2) * e.s * d; drawEnemy(e); }
    for (var j = pellets.length - 1; j >= 0; j--) {
      var p = pellets[j]; p.x += p.vx * d; p.y += p.vy * d; p.life -= d; var hit = null;
      for (var m = 0; m < enemies.length; m++) { var e2 = enemies[m]; if ((e2.x - p.x) * (e2.x - p.x) + (e2.y - p.y) * (e2.y - p.y) < (e2.r + 4) * (e2.r + 4)) { hit = e2; break; } }
      if (hit) { killAt(hit); pellets.splice(j, 1); continue; }
      if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) { pellets.splice(j, 1); continue; }
      ctx.fillStyle = PHOS; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    drawBursts(d);
    trail.push({ x: aim.x, y: aim.y }); if (trail.length > 8) trail.shift();
    arrow(aim.x, aim.y);
    if (!revealed && (kills >= REVEAL_KILLS || now - startT >= REVEAL_MS)) doReveal();
    if (!reduce && now - flashAt < 200) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - (now - flashAt) / 200) * 0.45 + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.drawImage(overlay, 0, 0, W, H);
  }
  function staticFrame() {
    resize(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < 10; i++) { var a = rnd(0, 6.28), rd = rnd(60, Math.min(W, H) * 0.4); enemies.push({ x: W / 2 + Math.cos(a) * rd, y: H / 2 + Math.sin(a) * rd, type: i % 3, r: 6, s: 0 }); }
    for (var k = 0; k < enemies.length; k++) drawEnemy(enemies[k]); arrow(W / 2, H / 2); ctx.drawImage(overlay, 0, 0, W, H); doReveal();
  }
  function frame(id) { return function f(now) { if (id !== runId || !running) return; step(now); requestAnimationFrame(f); }; }
  function resume() { if (reduce || running || !W) return; running = true; runId++; requestAnimationFrame(frame(runId)); }
  function pause() { running = false; }
  function start() {
    if (started || start._pending) return;
    resize();
    if (!W) { start._pending = true; setTimeout(function () { start._pending = false; start(); }, 100); return; }
    started = true;
    if (reduce) { staticFrame(); return; }
    resume();
  }

  function setAim(e) { if (ambient) return; var r = cv.getBoundingClientRect(); var t = e.touches && e.touches[0]; var cx = t ? t.clientX : e.clientX, cy = t ? t.clientY : e.clientY; aim.x = cx - r.left; aim.y = cy - r.top; lastMove = performance.now(); }
  cv.addEventListener('pointermove', setAim);
  cv.addEventListener('touchstart', setAim, { passive: true });
  cv.addEventListener('touchmove', setAim, { passive: true });
  window.addEventListener('resize', function () { resize(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else if (started) resume(); });
  var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) start(); else pause(); }); }, { threshold: 0.05 });
  io.observe(cv);
  start();
  setTimeout(doReveal, REVEAL_MS + 600);
})();
