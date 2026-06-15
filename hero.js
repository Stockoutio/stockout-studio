(function () {
  var cv = document.getElementById('heroCanvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var instr = document.getElementById('heroInstr');
  var rev = document.getElementById('heroReveal');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHOS = '#00ffaa', DIM = '#00cc88', ALERT = '#ff2233', INK = '#e8fff5', GR = '#ff3366', GB = '#33ccff';
  var W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
  var overlay = document.createElement('canvas');
  var mouse = { x: 0, y: 0, on: false };
  var enemies = [], pellets = [], bursts = [];
  var kills = 0, heat = 0, HMAX = 24, phase = 'idle';
  var ended = false, endAt = 0, flashAt = -9999, seeded = false;
  var lastFire = 0, lastSpawn = 0, running = false, runId = 0, started = false, last = 0;

  function ff(px) { return px + 'px "PressStart", ui-monospace, monospace'; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function feed() { return { x: W * 0.5, y: H * 0.46 }; }

  function resize() {
    W = cv.clientWidth || cv.offsetWidth; H = cv.clientHeight || cv.offsetHeight;
    if (!W || !H) return;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!mouse.on) { mouse.x = W * 0.5; mouse.y = H * 0.5; }
    buildOverlay();
  }
  function buildOverlay() {
    overlay.width = Math.round(W * DPR); overlay.height = Math.round(H * DPR);
    var o = overlay.getContext('2d'); o.setTransform(DPR, 0, 0, DPR, 0, 0); o.clearRect(0, 0, W, H);
    var g = o.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    o.fillStyle = g; o.fillRect(0, 0, W, H);
  }
  function spawn() {
    if (enemies.length > 44) return;
    var s = Math.floor(rnd(0, 4)), x, y;
    if (s === 0) { x = rnd(0, W); y = -20; } else if (s === 1) { x = rnd(0, W); y = H + 20; }
    else if (s === 2) { x = -20; y = rnd(0, H); } else { x = W + 20; y = rnd(0, H); }
    enemies.push({ x: x, y: y, type: Math.floor(rnd(0, 3)), r: 6, s: rnd(34, 64) });
  }
  function nearest(x, y) { var b = null, bd = 1e9; for (var i = 0; i < enemies.length; i++) { var e = enemies[i], d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y); if (d < bd) { bd = d; b = e; } } return b; }
  function explode(x, y, n) { var cols = [PHOS, GR, GB, INK]; for (var k = 0; k < (n || 7); k++) { var a = rnd(0, 6.28), sp = rnd(50, 200); bursts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: cols[Math.floor(rnd(0, cols.length))] }); } }
  function kill(e) {
    var i = enemies.indexOf(e); if (i < 0) return; enemies.splice(i, 1); kills++; if (heat < HMAX) heat++;
    explode(e.x, e.y, 7);
    if (heat >= HMAX) endGame();
  }
  function endGame() {
    if (ended) return; ended = true;
    if (rev) rev.classList.add('show'); if (instr) instr.style.opacity = '0.25';
    cv.style.cursor = 'auto';
    for (var i = 0; i < enemies.length; i++) explode(enemies[i].x, enemies[i].y, 6);
    enemies = []; pellets = [];
    flashAt = performance.now(); endAt = performance.now();
  }
  function arrow(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 19); ctx.lineTo(5, 14); ctx.lineTo(9, 21); ctx.lineTo(12, 19.5); ctx.lineTo(8, 13); ctx.lineTo(14, 13); ctx.closePath();
    ctx.fillStyle = PHOS; ctx.strokeStyle = '#003322'; ctx.lineWidth = 1; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function drawEnemy(e) {
    if (e.type === 0) { ctx.fillStyle = ALERT; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.28); ctx.fill(); }
    else if (e.type === 1) { ctx.strokeStyle = GB; ctx.lineWidth = 2; ctx.strokeRect(e.x - 7, e.y - 5, 14, 10); ctx.fillStyle = GB; ctx.font = ff(6); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RE:', e.x, e.y + 1); }
    else { ctx.strokeStyle = DIM; ctx.lineWidth = 1.5; ctx.strokeRect(e.x - 6, e.y - 6, 12, 12); ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 6); ctx.lineTo(e.x, e.y); ctx.lineTo(e.x + 6, e.y - 6); ctx.stroke(); }
  }
  function feedNode(now) {
    var f = feed(), p = ended ? 0 : 4 * Math.sin(now / 420);
    ctx.strokeStyle = 'rgba(255,34,51,' + (ended ? 0.35 : 0.6) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 22 + p, 0, 6.28); ctx.stroke();
    ctx.fillStyle = 'rgba(255,34,51,0.1)'; ctx.beginPath(); ctx.arc(f.x, f.y, 16 + p, 0, 6.28); ctx.fill();
    ctx.fillStyle = ALERT; ctx.font = ff(8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = ended ? 0.5 : 1; ctx.fillText('THE', f.x, f.y - 4); ctx.fillText('FEED', f.x, f.y + 6); ctx.globalAlpha = 1;
  }
  function hud() {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = ff(11);
    ctx.fillStyle = PHOS; ctx.fillText('TICKETS CLOSED: ' + kills, 22, 38);
    var bw = Math.min(160, W * 0.32), bx = W - bw - 22, by = 30;
    ctx.font = ff(9); ctx.fillStyle = DIM; ctx.fillText('HEAT', bx, by - 6);
    ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 10);
    var f = Math.min(1, heat / HMAX); ctx.fillStyle = f >= 1 ? ALERT : PHOS; ctx.fillRect(bx + 1, by + 1, (bw - 2) * f, 8);
  }
  function drawBursts(d) {
    for (var b = bursts.length - 1; b >= 0; b--) { var br = bursts[b]; br.x += br.vx * d; br.y += br.vy * d; br.life -= d * 1.8; if (br.life <= 0) { bursts.splice(b, 1); continue; } ctx.globalAlpha = Math.max(0, br.life); ctx.fillStyle = br.c; ctx.fillRect(br.x - 2, br.y - 2, 4, 4); ctx.globalAlpha = 1; }
  }

  function draw(now) {
    var d = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    feedNode(now);
    if (!ended) {
      if (phase === 'playing') {
        if (now - lastSpawn > 200) { lastSpawn = now; spawn(); }
        if (now - lastFire > 140) { lastFire = now; var tg = nearest(mouse.x, mouse.y); if (tg) { var a = Math.atan2(tg.y - mouse.y, tg.x - mouse.x); pellets.push({ x: mouse.x, y: mouse.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, life: 1.4 }); } }
      }
      var tgt = phase === 'idle' ? feed() : mouse;
      for (var i = enemies.length - 1; i >= 0; i--) { var e = enemies[i], a2 = Math.atan2(tgt.y - e.y, tgt.x - e.x); e.x += Math.cos(a2) * e.s * d; e.y += Math.sin(a2) * e.s * d; drawEnemy(e); }
      for (var j = pellets.length - 1; j >= 0; j--) {
        var p = pellets[j]; p.x += p.vx * d; p.y += p.vy * d; p.life -= d; var hit = null;
        for (var m = 0; m < enemies.length; m++) { var e2 = enemies[m]; if ((e2.x - p.x) * (e2.x - p.x) + (e2.y - p.y) * (e2.y - p.y) < (e2.r + 4) * (e2.r + 4)) { hit = e2; break; } }
        if (hit) { kill(hit); pellets.splice(j, 1); continue; }
        if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) { pellets.splice(j, 1); continue; }
        ctx.fillStyle = PHOS; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      drawBursts(d);
      if (phase !== 'idle') { hud(); arrow(mouse.x, mouse.y); } else { idleText(now); }
    } else {
      drawBursts(d);
      if (!reduce && now - flashAt < 200) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - (now - flashAt) / 200) * 0.8 + ')'; ctx.fillRect(0, 0, W, H); }
    }
    ctx.drawImage(overlay, 0, 0, W, H);
    if (ended && bursts.length === 0 && now - endAt > 300) running = false;
  }
  function idleText(now) {
    var f = feed(); var b = Math.floor(now / 520) % 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = ff(10); ctx.fillStyle = b ? PHOS : 'rgba(0,255,170,0.3)';
    ctx.fillText('CLEAR THE SWARM', f.x, f.y + 64);
  }
  function staticFrame() {
    resize();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ended = true; feedNode(0); ctx.drawImage(overlay, 0, 0, W, H);
    cv.style.cursor = 'auto'; if (rev) rev.classList.add('show'); if (instr) instr.style.opacity = '0.25';
  }
  function tick(id) { return function f(now) { if (id !== runId || !running) return; draw(now); requestAnimationFrame(f); }; }
  function resume() { if (reduce || running || ended || !W) return; running = true; runId++; requestAnimationFrame(tick(runId)); }
  function pause() { running = false; }
  function start() { if (started) return; started = true; resize(); if (reduce) { staticFrame(); return; } resume(); }

  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
    if (phase === 'idle' && !ended) { phase = 'playing'; if (!seeded) { seeded = true; for (var i = 0; i < 12; i++) spawn(); } }
  });
  window.addEventListener('resize', function () { resize(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else if (started) resume(); });
  var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) start(); else pause(); }); }, { threshold: 0.12 });
  io.observe(cv);
  setTimeout(endGame, 9000);
  window.addEventListener('scroll', function () { if (window.scrollY > (H || 400) * 0.55) endGame(); }, { passive: true });
})();
