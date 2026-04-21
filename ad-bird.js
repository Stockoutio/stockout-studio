const KEYMAP = Object.freeze({
    flapCodes: ['Space','ArrowUp','KeyW','KeyK'],
    bombCodes: ['ShiftLeft','ShiftRight','ArrowDown','KeyS','KeyJ'],
    flapKeys: [' ','ArrowUp','w','W','k','K'],
    bombKeys: ['Shift','ArrowDown','s','S','j','J']
});

class AdBird {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.overlay = document.getElementById('gameOverlay');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this._setupHiDPI();
        this._initSettings(options);
        this._initHUDGeometry();
        this._initState();
        this._initBuffers();
        this._initEngine();
    }

    _safeStorage(action, key, value) {
        try {
            if (action === 'get') return localStorage.getItem(key);
            if (action === 'set') localStorage.setItem(key, value);
        } catch (e) {
            return null;
        }
    }

    /* --- INITIALIZATION --- */

    _initSettings(options) {
        this.config = {
            gravity: 0.5, lift: -8, pipeWidth: 110, pipeSpeed: 2.4, bgSpeed: 0.5,
            minGap: 250, maxGap: 350,
            minPipeHeightBottom: 250, minPipeHeightTop: 30,
            bubbleCount: 20, worldShiftInterval: 10, bombCooldown: 20,
            playerImg: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png',
            musicSrc: 'bg-music.mp3', worlds: ['world1.jpg', 'world2.jpg', 'world3.jpg'],
            
            // --- Content ---
            paidAds: options.paidAds || [],
            stockAds: options.stockAds || window.AdBirdContent.STOCK_ADS,
            maxStockConsecutive: 3,
            hitMessages: window.AdBirdContent.HIT_MESSAGES,
            gameOverMessages: window.AdBirdContent.GAME_OVER_MESSAGES,
            readyMessages: window.AdBirdContent.READY_MESSAGES,
            msgColors: ["#a855f7", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899"],

            // --- Pass 2: Refactor Configs ---
            screenShakeDecay: 0.9,
            particleGravity: 0.15,
            particleLifeDecay: 0.02,
            birdRotationFactor: 0.05,
            floatingTextRiseDelay: 30,
            floatingTextMaxAge: 70,

            _toneConfigs: {
                flap: { type: 'square', freq: [150, 400], vol: 0.5, dur: 0.1 },
                score: { type: 'sine', freq: [800, 1200], vol: 0.4, dur: 0.1 },
                crash: { type: 'sawtooth', freq: [100, 20], vol: 0.6, dur: 0.5 },
                shift: { type: 'square', freq: [200, 800], vol: 0.5, dur: 0.3 }
            }
        };
    }

    // NOTE: Depends on _setupHiDPI() having already run so canvas.width/height return logical dimensions.
    _initHUDGeometry() {
        this.ui = {
            fullscreenBtn: { x: this.canvas.width - 55, y: this.canvas.height - 55, radius: 45 },
            bombBtn: { x: 20, y: this.canvas.height - 120, w: 160, h: 100, radius: 15 },
            muteBtn: { x: this.canvas.width - 20, y: 50 },
            scoreCenter: this.canvas.width / 2
        };
    }

    _initState() {
        this.state = {
            gameRunning: false, isGameOver: false, loopActive: false,
            score: 0, directHits: 0, highScore: parseInt(this._safeStorage('get', 'adBirdHighScore')) || 0,
            highDirectHits: parseInt(this._safeStorage('get', 'adBirdHighDirectHits')) || 0,
            frameCount: 0, nextPipeFrame: 40, currentWorld: 0, flashOpacity: 0, isMuted: false, bgX: 0, screenShake: 0,
            bombTimer: 0, isFullscreen: false, assetsLoaded: 0, lastRect: null, 
            paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], readyMsgBag: [], worldBag: [], stockInARow: 0,
            particles: [], deathMsg: "", currentReadyMsg: ""
        };
        this.state.currentWorld = this._nextWorld();
        this.state.currentReadyMsg = this._nextFromBag('readyMsgBag', 'readyMessages');
        this.player = { x: 320, y: 150, w: 100, h: 100, velocity: 0, flipAngle: 0, isFlipping: false, flipSpeed: 0.25, flipDirection: 1 };
    }

    _initBuffers() {
        this.pipes = []; this.bombs = []; this.bubbles = []; this.floatingTexts = [];
        this.assets = { player: new Image(), worlds: [], music: new Audio(this.config.musicSrc) };
        this.assets.music.loop = true;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    _initEngine() {
        this._boundLoop = () => this._loop();
        this.assets.player.src = this.config.playerImg;
        this.assets.player.onload = () => this.state.assetsLoaded++;
        this.config.worlds.forEach((p) => { const img = new Image(); img.src = p; img.onload = () => { this.state.assetsLoaded++; }; this.assets.worlds.push(img); });
        window.addEventListener('keydown', (e) => this._handleKeydown(e));
        const it = this.canvas.parentElement || this.canvas;
        it.addEventListener('mousedown', (e) => { if (!this.isMobile) this._handleInput(e); });
        it.addEventListener('touchstart', (e) => { if (this.isMobile) { e.preventDefault(); for (let i = 0; i < e.changedTouches.length; i++) { const t = e.changedTouches[i]; this._handleInput({ clientX: t.clientX, clientY: t.clientY, button: 0, preventDefault: () => {} }); } } }, { passive: false });
        it.addEventListener('contextmenu', (e) => e.preventDefault());
        if (this.overlay) { 
            this.overlay.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (this.state.isGameOver) this._resetToSplash();
                else this.start();
            }); 
            this.overlay.addEventListener('touchstart', (e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                if (this.state.isGameOver) this._resetToSplash();
                else this.start();
            }); 
        }
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => document.addEventListener(evt, () => { this.state.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement); }));
        this._initBubbles();
        this._loop();
    }

    /* --- INPUT ENGINE --- */

    _handleKeydown(e) {
        const isFlap = KEYMAP.flapCodes.includes(e.code) || KEYMAP.flapKeys.includes(e.key), isBomb = KEYMAP.bombCodes.includes(e.code) || KEYMAP.bombKeys.includes(e.key);
        if (isFlap || isBomb || e.code === 'KeyF' || e.key === 'f' || e.key === 'F') { 
            e.preventDefault(); 
            if (this.state.isGameOver) { this._resetToSplash(); return; }
            if (!this.state.gameRunning) this.start(); 
            else { if (isFlap) this.flap(); if (isBomb) this.dropBomb(); if (e.code==='KeyF'||e.key==='f') this.toggleFullscreen(); } 
        }
    }

    _handleInput(e) {
        const r = this.state.lastRect || this.canvas.getBoundingClientRect();
        const canvasAspect = this.canvas.width / this.canvas.height;
        const rectAspect = r.width / r.height;
        let dw, dh, dx, dy;
        if (rectAspect > canvasAspect) {
            // Element is wider than canvas aspect — letterboxed left/right
            dh = r.height;
            dw = dh * canvasAspect;
            dx = (r.width - dw) / 2;
            dy = 0;
        } else {
            // Element is taller than canvas aspect — letterboxed top/bottom
            dw = r.width;
            dh = dw / canvasAspect;
            dx = 0;
            dy = (r.height - dh) / 2;
        }
        const x = Math.max(0, Math.min(this.canvas.width, (e.clientX - (r.left + dx)) * (this.canvas.width / dw)));
        const y = Math.max(0, Math.min(this.canvas.height, (e.clientY - (r.top + dy)) * (this.canvas.height / dh)));
        
        if (this.state.isGameOver) { this._resetToSplash(); return; }
        
        const action = this._hitTest(x, y);
        
        // Fullscreen and mute work regardless of game state
        if (action === 'fullscreen') { this.toggleFullscreen(); return; }
        if (action === 'mute') { this.toggleMute(); return; }
        
        // If game isn't running, any click (including bomb button) starts it
        if (!this.state.gameRunning) { this.start(); return; }
        
        // Game is running — dispatch normally
        if (action === 'bomb') { this.dropBomb(); return; }
        if (e.button === 2) this.dropBomb();
        else this.flap();
    }

    _hitTest(x, y) {
        if (Math.hypot(x - this.ui.fullscreenBtn.x, y - this.ui.fullscreenBtn.y) < 70) return 'fullscreen';
        if (x > this.canvas.width - 80 && y < 120) return 'mute';
        const b = this.ui.bombBtn;
        if (x >= b.x - 20 && x <= b.x + b.w + 20 && y >= b.y - 20 && y <= b.y + b.h + 20) return 'bomb';
        return null;
    }

    /* --- CORE LOOP & PHYSICS --- */

    start() {
        if (this.state.assetsLoaded < this.config.worlds.length + 1) return;
        if (this.overlay) this.overlay.classList.remove('active');
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        Object.assign(this.state, { gameRunning: true, isGameOver: false, score: 0, directHits: 0, frameCount: 0, nextPipeFrame: 40, bgX: 0, screenShake: 0, bombTimer: 0, paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], stockInARow: 0, particles: [] });
        Object.assign(this.player, { y: 150, velocity: 0, flipAngle: 0, isFlipping: false });
        this.pipes = []; this.bombs = []; this.floatingTexts = [];
        if (this.assets.music && !this.state.isMuted) { this.assets.music.currentTime = 0; this.assets.music.play().catch(() => {}); }
        if (!this.state.loopActive) this._loop();
    }

    _loop() { 
        this.state.loopActive = true; 
        this.state.lastRect = this.canvas.getBoundingClientRect(); 
        this._update(); 
        this._draw(); 
        requestAnimationFrame(this._boundLoop); 
    }

    _update() {
        if (this.state.screenShake > 0) this.state.screenShake *= this.config.screenShakeDecay;
        
        if (!this.state.gameRunning) { 
            if (!this.state.isGameOver) {
                this.player.y = 150;
                this.player.velocity = 0;
            } else {
                this.player.velocity += this.config.gravity; 
                this.player.y += this.player.velocity;
            }
            this.player.flipAngle += this.player.flipDirection * 0.2; 
            return; 
        }

        this.player.velocity += this.config.gravity; 
        this.player.y += this.player.velocity;
        this.state.bgX = (this.state.bgX - this.config.bgSpeed) % this.canvas.width;
        if (this.state.bombTimer > 0) this.state.bombTimer--;
        if (this.player.isFlipping) { this.player.flipAngle += this.player.flipDirection * this.player.flipSpeed; if (Math.abs(this.player.flipAngle) >= Math.PI * 2) { this.player.flipAngle = 0; this.player.isFlipping = false; } }
        if (this.state.frameCount >= this.state.nextPipeFrame) this._spawnPipe();
        this._updateEntities();
        if (this.player.y + this.player.h > this.canvas.height || this.player.y < 0) this.gameOver();
        this.state.frameCount++;
    }

    _updateEntities() {
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i]; p.x -= this.config.pipeSpeed;
            p.stains.forEach(s => s.drips.forEach(d => { if (d.len < d.maxLen) d.len += d.speed; }));
            const pd = 15; const bx = this.player.x+pd, bw = this.player.w-(pd*2), by = this.player.y+pd, bh = this.player.h-(pd*2);
            if (bx < p.x+p.w && bx+bw > p.x && (by < p.y || by+bh > p.y+p.gap)) { this.gameOver(); return; }
            if (!p.scored && p.x + p.w < this.player.x) { p.scored = true; this.state.score++; this.playSound('score'); if (this.state.score % this.config.worldShiftInterval === 0) this._shiftWorld(); }
            if (p.x + p.w < -150) this.pipes.splice(i, 1);
        }
        for (let i = this.bombs.length - 1; i >= 0; i--) { 
            const b = this.bombs[i]; b.y += b.speed; let hit = false; 
            for (const p of this.pipes) { 
                if (b.x > p.x && b.x < p.x + p.w && (b.y < p.y || b.y > p.y + p.gap)) { 
                    this._createSplat(p, b.x, b.y, b.scale); 
                    hit = true; break; 
                } 
            } if (hit || b.y > this.canvas.height) this.bombs.splice(i, 1); 
        }
        this.bubbles.forEach(b => { b.x -= b.speed; if (b.x < -10) b.x = this.canvas.width + 10; });
        for (let i = this.state.particles.length - 1; i >= 0; i--) { 
            const p = this.state.particles[i]; p.x += p.vx; p.y += p.vy; 
            p.vy += this.config.particleGravity; p.life -= this.config.particleLifeDecay; 
            if (p.life <= 0) this.state.particles.splice(i, 1); 
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) { 
            const t = this.floatingTexts[i]; t.age++; 
            if (t.age > this.config.floatingTextRiseDelay) { 
                t.vy -= 0.3; t.y += t.vy; t.alpha = Math.max(0, 1 - Math.pow((t.age - this.config.floatingTextRiseDelay) / 40, 2)); 
            } 
            if (t.alpha <= 0 || t.age > this.config.floatingTextMaxAge) this.floatingTexts.splice(i, 1); 
        }
    }

    _spawnPipe() {
        const ad = this._nextAd();
        const gap = Math.floor(Math.random() * (this.config.maxGap - this.config.minGap)) + this.config.minGap;
        const minH_top = this.config.minPipeHeightTop;
        const maxH_top = this.canvas.height - gap - this.config.minPipeHeightBottom;
        const h = Math.floor(Math.random() * (maxH_top - minH_top)) + minH_top;
        this.pipes.push({ x: this.canvas.width, y: h, w: this.config.pipeWidth, gap: gap, ad: ad, scored: false, stains: [] });
        this.state.nextPipeFrame = this.state.frameCount + Math.floor(Math.random() * 100) + 100;
    }

    /* --- RENDERING --- */

    _draw() {
        this.ctx.save(); if (this.state.screenShake > 0.5) this.ctx.translate((Math.random()-0.5)*this.state.screenShake, (Math.random()-0.5)*this.state.screenShake);
        this.ctx.clearRect(-10, -10, this.canvas.width+20, this.canvas.height+20);
        this._renderWorld(); this._renderBubbles(); this._renderPipes(); this._renderBombs(); 
        if (this.state.gameRunning || this.state.isGameOver) this._renderPlayer();
        this._renderParticles(); this._renderFloatingTexts(); this._renderOverlay();
        this.ctx.restore();
    }

    _renderPipes() {
        this.pipes.forEach(p => {
            this._drawPipeBody(p);
            this._drawPipeBorders(p, p.ad.color, 3);
            this._drawPipeCaps(p, p.ad.color, 3, 18);
            this._drawPipeStains(p, 3);
            this._drawPipeLabel(p, p.ad.color);
        });
    }

    _drawPipeBody(p) {
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.95)";
        this.ctx.fillRect(p.x, 0, p.w, p.y);
        this.ctx.fillRect(p.x, p.y + p.gap, p.w, this.canvas.height);
    }

    _drawPipeBorders(p, gc, bW) {
        this.ctx.fillStyle = gc;
        this.ctx.fillRect(p.x - bW, 0, bW, p.y);
        this.ctx.fillRect(p.x + p.w, 0, bW, p.y);
        this.ctx.fillRect(p.x - bW, p.y + p.gap, bW, this.canvas.height);
        this.ctx.fillRect(p.x + p.w, p.y + p.gap, bW, this.canvas.height);
    }

    _drawPipeCaps(p, gc, bW, capH) {
        this.ctx.save();
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = gc;
        this.ctx.fillStyle = gc;
        this.ctx.fillRect(p.x - bW, p.y - capH, p.w + (bW * 2), capH);
        this.ctx.fillRect(p.x - bW, p.y + p.gap, p.w + (bW * 2), capH);
        const ph = (Math.sin(this.state.frameCount * 0.05) + 1) / 2;
        const lo = 2 + (ph * (capH - 6));
        this.ctx.fillStyle = "rgba(255,255,255,0.9)";
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "#fff";
        this.ctx.fillRect(p.x - bW, p.y - capH + lo, p.w + (bW * 2), 2);
        this.ctx.fillRect(p.x - bW, p.y + p.gap + lo, p.w + (bW * 2), 2);
        this.ctx.restore();
    }

    _drawPipeStains(p, bW) {
        [0, p.y + p.gap].forEach(sy => {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(p.x - bW, sy, p.w + (bW * 2), sy === 0 ? p.y : this.canvas.height);
            this.ctx.clip();
            p.stains.forEach(s => {
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                this.ctx.beginPath();
                this.ctx.arc(p.x + s.xOff, s.relY, s.size, 0, Math.PI * 2);
                this.ctx.fill();
                s.drips.forEach(d => {
                    this.ctx.beginPath();
                    this.ctx.roundRect(p.x + s.xOff + d.xOff, s.relY, d.w, d.len, d.w / 2);
                    this.ctx.fill();
                });
            });
            this.ctx.restore();
        });
    }

    _drawPipeLabel(p, gc) {
        this.ctx.save();
        this.ctx.translate(p.x + p.w / 2, p.y + p.gap + (this.canvas.height - (p.y + p.gap)) / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillStyle = "#fff";
        this.ctx.font = "bold 20px 'Outfit', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.shadowColor = gc;
        this.ctx.shadowBlur = 12;
        this.ctx.fillText(p.ad.text, 0, 0);
        this.ctx.restore();
    }

    _renderHUD() {
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "alphabetic"; this.ctx.font = "bold 48px 'Outfit', sans-serif"; this.ctx.fillText(this.state.score, this.ui.scoreCenter, 65);
        // --- MARKETING IMPACT: ROLLING HIGHLIGHT ---
        this.ctx.save();
        const impactText = "MARKETING IMPACT: ";
        const impactNum = this.state.directHits.toString();
        const fullStr = impactText + impactNum;
        
        this.ctx.font = "bold 18px 'Outfit', sans-serif";
        const labelW = this.ctx.measureText(impactText).width;
        this.ctx.font = "bold 52px 'Outfit', sans-serif";
        const numW = this.ctx.measureText(impactNum).width;
        
        // Gentle Horizontal Sway (Subtler)
        const sway = Math.sin(this.state.frameCount * 0.03) * 4;
        let curX = this.ui.scoreCenter - (labelW + numW) / 2 + sway;

        this.ctx.textBaseline = "middle";
        this.ctx.textAlign = "left";
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "#06b6d4";

        // Draw Label with Rolling Highlight
        this.ctx.font = "bold 18px 'Outfit', sans-serif";
        for (let i = 0; i < impactText.length; i++) {
            const char = impactText[i];
            const peak = (Math.sin(this.state.frameCount * 0.08) + 1) / 2 * impactText.length;
            const dist = Math.abs(i - peak);
            const alpha = Math.max(0.4, 1 - (dist / 8));
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.fillText(char, curX, 100);
            curX += this.ctx.measureText(char).width;
        }

        // Draw Number (WHITE & PULSING GLOW)
        this.ctx.font = "bold 52px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fff";
        this.ctx.shadowBlur = 15 + Math.sin(this.state.frameCount * 0.1) * 10;
        this.ctx.fillText(impactNum, curX + 5, 100);
        this.ctx.restore();
        this.ctx.font = "24px serif"; this.ctx.textAlign = "right"; this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.ui.muteBtn.x, this.ui.muteBtn.y);
        const fs = this.ui.fullscreenBtn; this.ctx.save(); this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)"; this.ctx.beginPath(); this.ctx.arc(fs.x, fs.y, fs.radius, 0, Math.PI * 2); this.ctx.fill(); this.ctx.font = "bold 54px serif"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; this.ctx.fillText("⤢", fs.x, fs.y + 4); this.ctx.restore();
        const b = this.ui.bombBtn; this.ctx.save(); this.ctx.fillStyle = this.state.bombTimer > 0 ? "rgba(255, 255, 255, 0.15)" : "rgba(6, 182, 212, 0.6)"; this.ctx.shadowBlur = 15; this.ctx.shadowColor = "#06b6d4"; this.ctx.beginPath(); this.ctx.roundRect(b.x, b.y, b.w, b.h, b.radius); this.ctx.fill();
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.font = "bold 32px 'Outfit', sans-serif"; this.ctx.shadowBlur = 0; this.ctx.fillText("BOMB", b.x + b.w/2, b.y + b.h/2 - (this.isMobile ? 0 : 8)); 
        if (!this.isMobile) { this.ctx.font = "bold 11px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; this.ctx.fillText("(SHIFT / R-CLICK)", b.x + b.w/2, b.y + b.h/2 + 22); } 
        if (this.state.bombTimer > 0) { this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; this.ctx.fillRect(b.x, b.y + b.h - 4, b.w * (this.state.bombTimer / this.config.bombCooldown), 4); } this.ctx.restore();
    }

    /* --- ENTROPY & AD ENGINE --- */

    _shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    _nextWorld() {
        if (this.state.worldBag.length === 0) {
            const indices = Array.from({ length: this.config.worlds.length }, (_, i) => i);
            this.state.worldBag = this._shuffle(indices);
        }
        return this.state.worldBag.pop();
    }

    _nextFromBag(bagKey, configKey) {
        if (this.state[bagKey].length === 0) {
            this.state[bagKey] = this._shuffle(this.config[configKey]);
        }
        return this.state[bagKey].pop();
    }

    _nextAd() {
        if (this.state.paidBag.length === 0 && this.config.paidAds.length > 0) {
            if (this.state.stockInARow >= this.config.maxStockConsecutive || this.state.score === 0) {
                this.state.paidBag = this._shuffle(this.config.paidAds);
                this.state.stockInARow = 0;
            }
        }
        if (this.state.paidBag.length > 0) {
            this.state.stockInARow = 0;
            return this.state.paidBag.pop();
        }
        if (this.state.stockBag.length === 0) {
            this.state.stockBag = this._shuffle(this.config.stockAds);
        }
        this.state.stockInARow++;
        return this.state.stockBag.pop();
    }

    _createSplat(p, bx, by, scale = 1.0) { 
        const isMega = scale >= 5.0;
        this.state.screenShake = isMega ? 30 : 10 * scale; 
        if (isMega) this.state.flashOpacity = 0.4;
        this.state.directHits++; this.player.isFlipping = true; this.player.flipAngle = 0; 
        
        const pCount = isMega ? 60 : 15;
        for (let i=0; i<pCount; i++) {
            this.state.particles.push({ 
                x: bx, y: by, 
                vx: (Math.random()-0.5)*(isMega ? 25 : 10), 
                vy: (Math.random()-0.5)*(isMega ? 25 : 10)-2, 
                color: p.ad.color, life: 1.0 + (isMega ? Math.random() : 0),
                size: isMega ? Math.random()*6+2 : 3,
                isMega: isMega
            }); 
        }
        
        p.stains.push({ 
            relY: by, xOff: bx-p.x, 
            size: (Math.random()*8+12) * scale, 
            drips: Array.from({length:3},()=>({
                xOff:(Math.random()-0.5)*20,
                len:0,
                maxLen:(40+Math.random()*60) * scale,
                speed:(1.0+Math.random()*1.5) * scale,
                w:(3+Math.random()*4) * scale
            })) 
        }); 
        let sy = by-40; this.floatingTexts.forEach(t => { if (Math.abs(t.x-bx)<50 && Math.abs(t.y-sy)<30) sy-=40; }); 
        
        let hitMsg, align = "center", tx = bx;
        if (isMega) {
            const mega = ["MEGA SPLAT", "GIGA SPLAT", "AD-POCALYPSE", "ULTRA-BILL", "MONSTER SPLAT", "SIGN DESTROYER", "MARKET CRASHED", "KPIs CRUSHED", "BRAND DESTRUCTION", "TOTAL COVERAGE"];
            hitMsg = mega[Math.floor(Math.random()*mega.length)];
            // Smart Alignment Guard
            if (bx < 280) { align = "left"; tx = 20; }
            else if (bx > this.canvas.width - 280) { align = "right"; tx = this.canvas.width - 20; }
        } else {
            hitMsg = this._nextFromBag('hitMsgBag', 'hitMessages');
        }

        this.floatingTexts.push({ 
            x: tx, y: sy, age: 0, vy: isMega ? -4 : 0, alpha: 1, 
            scale: isMega ? 1.4 : 1, 
            text: hitMsg, 
            color: isMega ? "#fff" : this.config.msgColors[Math.floor(Math.random()*this.config.msgColors.length)],
            glow: isMega ? p.ad.color : null,
            isMega: isMega,
            align: align
        }); 
        this.playSound('splat'); 
    }

    gameOver() { 
        if (this.state.isGameOver) return; this.state.isGameOver = true; this.state.screenShake = 20; this.state.gameRunning = false; 
        this.state.deathMsg = this._nextFromBag('gameOverMsgBag', 'gameOverMessages');
        this.floatingTexts = []; // Clear floating texts so they don't block the score
        this.playSound('crash'); setTimeout(() => this.playSound('death'), 300); if (this.assets.music) this.assets.music.pause(); if (this.state.score > this.state.highScore) { this.state.highScore = this.state.score; this._safeStorage('set', 'adBirdHighScore', this.state.highScore); } if (this.state.directHits > this.state.highDirectHits) { this.state.highDirectHits = this.state.directHits; this._safeStorage('set', 'adBirdHighDirectHits', this.state.highDirectHits); } if (this.isMobile && this.overlay) this.overlay.classList.add('active'); 
    }

    /* --- HELPERS --- */

    playSound(type) { 
        if (this.state.isMuted) return; 
        if (type === 'splat') this._playSplat();
        else if (type === 'death') this._playDeath();
        else if (this.config._toneConfigs[type]) this._playTone(this.config._toneConfigs[type]);
    }

    _playTone(s, delay = 0) {
        const n = this.audioCtx.currentTime + delay;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.connect(g); g.connect(this.audioCtx.destination);
        o.type = s.type;
        o.frequency.setValueAtTime(s.freq[0], n);
        o.frequency.exponentialRampToValueAtTime(s.freq[1], n + s.dur);
        g.gain.setValueAtTime(s.vol, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + s.dur);
        o.start(n); o.stop(n + s.dur);
    }

    _playSplat() {
        this._playTone({ type: 'square', freq: [400, 800], vol: 0.3, dur: 0.15 });
    }

    _playDeath() {
        [392, 311, 261].forEach((f, i) => {
            this._playTone({ type: 'triangle', freq: [f, f * 0.8], vol: 0.3, dur: 0.4 }, i * 0.15);
        });
    }

    toggleMute() { 
        this.state.isMuted = !this.state.isMuted; 
        if (this.assets.music) { 
            if (this.state.isMuted) this.assets.music.pause(); 
            else if (this.state.gameRunning) this.assets.music.play(); 
        } 
    }
    toggleFullscreen() { const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement); if (!isFS) { const c = this.canvas.parentElement; const r = c.requestFullscreen || c.webkitRequestFullscreen || c.mozRequestFullScreen || c.msRequestFullscreen; if (r) r.call(c); } else { const e = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen; if (e) e.call(document); } }
    _shiftWorld() { this.state.currentWorld = (this.state.currentWorld + 1) % this.assets.worlds.length; this.state.flashOpacity = 1; this.playSound('shift'); }
    flap() { this.player.velocity = this.config.lift; this.playSound('flap'); }
    dropBomb() { 
        if (this.state.bombTimer > 0) return; 
        const scale = 0.5 + Math.pow(Math.random(), 2.5) * 5.5; 
        this.bombs.push({ x: this.player.x+this.player.w/2, y: this.player.y+this.player.h-10, w: 15 * scale, h: 20 * scale, speed: 8, scale: scale }); 
        this.state.bombTimer = this.config.bombCooldown; 
    }
    _renderWorld() { 
        const bg = this.assets.worlds[this.state.currentWorld]; 
        if (bg && bg.complete) { 
            const rx = this.state.bgX; 
            this.ctx.drawImage(bg, rx, 0, this.canvas.width + 2, this.canvas.height); 
            this.ctx.drawImage(bg, rx + this.canvas.width, 0, this.canvas.width, this.canvas.height); 
        } if (this.state.flashOpacity > 0) { this.ctx.fillStyle = `rgba(255, 255, 255, ${this.state.flashOpacity})`; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.state.flashOpacity -= 0.05; } }
    _renderBubbles() { this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; this.bubbles.forEach(b => { this.ctx.beginPath(); this.ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); this.ctx.fill(); }); }
    _renderBombs() { this.ctx.fillStyle = "#fff"; this.bombs.forEach(b => { this.ctx.beginPath(); this.ctx.ellipse(b.x, b.y, b.w/2, b.h/2, 0, 0, Math.PI*2); this.ctx.fill(); }); }
    _renderPlayer() { 
        this.ctx.save(); 
        this.ctx.translate(this.player.x+this.player.w/2, this.player.y+this.player.h/2); 
        this.ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/4, this.player.velocity * this.config.birdRotationFactor)) + this.player.flipAngle); 
        this.ctx.scale(-1, 1); 
        this.ctx.drawImage(this.assets.player, -this.player.w/2, -this.player.h/2, this.player.w, this.player.h); 
        this.ctx.restore(); 
    }
    _renderParticles() { 
        this.state.particles.forEach(p => { 
            this.ctx.globalAlpha = p.life; this.ctx.fillStyle = p.color; 
            this.ctx.shadowBlur = p.isMega ? 15 : 10; this.ctx.shadowColor = p.color; 
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI*2); this.ctx.fill(); 
        }); 
        this.ctx.globalAlpha = 1; this.ctx.shadowBlur = 0; 
    }
    _renderFloatingTexts() { 
        this.floatingTexts.forEach(t => { 
            this.ctx.save(); 
            this.ctx.textAlign = t.align || "center"; 
            this.ctx.globalAlpha = t.alpha; this.ctx.translate(t.x, t.y); this.ctx.scale(t.scale, t.scale); 
            this.ctx.font = t.isMega ? "900 38px 'Outfit', sans-serif" : "bold 32px 'Outfit', sans-serif"; 
            if (t.glow) { this.ctx.shadowBlur = 25; this.ctx.shadowColor = t.glow; }
            this.ctx.strokeStyle = "#000"; this.ctx.lineWidth = t.isMega ? 3 : 1.5; this.ctx.strokeText(t.text, 0, 0); 
            this.ctx.fillStyle = t.color; this.ctx.fillText(t.text, 0, 0); 
            this.ctx.restore(); 
        }); 
    }
    _renderGameOverScreen() { this.ctx.fillStyle = "rgba(10, 10, 15, 0.85)"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.ctx.fillStyle = "#fff"; this.ctx.font = "bold 36px 'Outfit', sans-serif"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "alphabetic"; this.ctx.fillText(this.state.deathMsg, this.canvas.width / 2, this.canvas.height / 2 - 60); this.ctx.font = "bold 20px 'Outfit', sans-serif"; this.ctx.fillText(`Score: ${this.state.score}`, this.canvas.width / 2 - 80, this.canvas.height / 2); this.ctx.fillStyle = "#fbbf24"; this.ctx.fillText(`Best: ${this.state.highScore}`, this.canvas.width / 2 + 80, this.canvas.height / 2); this.ctx.fillStyle = "#fff"; this.ctx.fillText(`Impact: ${this.state.directHits}`, this.canvas.width / 2 - 80, this.canvas.height / 2 + 35); this.ctx.fillStyle = "#06b6d4"; this.ctx.fillText(`Best: ${this.state.highDirectHits}`, this.canvas.width / 2 + 80, this.canvas.height / 2 + 35); this.ctx.fillStyle = "rgba(255,255,255,0.5)"; this.ctx.font = "14px 'Outfit', sans-serif"; this.ctx.fillText(this.isMobile ? "TAP to continue" : "SPACE or CLICK to continue", this.canvas.width / 2, this.canvas.height / 2 + 85); }
    _renderStartScreen() { 
        if (this.isMobile && this.overlay) this.overlay.classList.add('active'); 
        const boxW = 550;
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)"; this.ctx.fillRect(this.canvas.width / 2 - boxW/2, this.canvas.height / 2 - 60, boxW, 135); 
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; this.ctx.strokeRect(this.canvas.width / 2 - boxW/2, this.canvas.height / 2 - 60, boxW, 135); 
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.font = "bold 24px 'Outfit', sans-serif"; 
        this.ctx.fillText(this.state.currentReadyMsg, this.canvas.width / 2, this.canvas.height / 2 - 10); 
        this.ctx.font = "15px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; 
        this.ctx.fillText(this.isMobile ? "TAP ANYWHERE to flap" : "SPACE or CLICK to flap", this.canvas.width / 2, this.canvas.height / 2 + 30); 
        this.ctx.fillText(this.isMobile ? "BOMB BUTTON to drop ads" : "SHIFT or R-CLICK to bomb", this.canvas.width / 2, this.canvas.height / 2 + 55); 
    }
    _resetToSplash() {
        this.state.isGameOver = false;
        this.state.currentReadyMsg = this._nextFromBag('readyMsgBag', 'readyMessages');
        this.pipes = [];
        this.bombs = [];
        this.floatingTexts = [];
        this.state.bgX = 0;
        this.state.currentWorld = this._nextWorld();
        this.state.screenShake = 15;
        this.state.flashOpacity = 1;
        this.playSound('shift');
        const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
        const colors = this.config.msgColors;
        for (let i=0; i<30; i++) {
            this.state.particles.push({
                x: cx, y: cy, 
                vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                color: colors[Math.floor(Math.random()*colors.length)],
                life: 1.0
            });
        }
    }
    _setupHiDPI() { const dpr = window.devicePixelRatio || 1; if (dpr > 1) { const lw = this.canvas.width; const lh = this.canvas.height; this.canvas.width = lw * dpr; this.canvas.height = lh * dpr; this.ctx.scale(dpr, dpr); 
        // NOTE: Locks canvas.width/height to logical size for DPR scaling.
        // Any future code that tries to resize the canvas will silently fail.
        Object.defineProperty(this.canvas, 'width', { get: () => lw, configurable: true }); Object.defineProperty(this.canvas, 'height', { get: () => lh, configurable: true }); } this.canvas.style.touchAction = 'none'; this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
    _renderOverlay() { 
        this._renderHUD(); 
        if (this.state.isGameOver) this._renderGameOverScreen(); 
        else if (!this.state.gameRunning) this._renderStartScreen();
    }
    _initBubbles() { this.bubbles = Array.from({ length: 20 }, () => ({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, size: Math.random() * 3 + 1, speed: Math.random() * 0.5 + 0.2 })); }
}

document.addEventListener('DOMContentLoaded', () => {
    const initGame = async () => {
        let paidAds = [];
        const SUPABASE_URL = 'https://agbtvbymknayxrebochn.supabase.co'; 
        const SUPABASE_KEY = 'sb_publishable_8yipwhYLiM19LVR8qLXT6A_MOD1YTl1';
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/ads?select=text&is_paid=eq.true&status=eq.approved&expires_at=gt.now()`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (response.ok) {
                const data = await response.json();
                const colors = ['#a855f7', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899'];
                paidAds = data.map(ad => {
                    // Hash the ad text to pick a stable color
                    let hash = 0;
                    for (let i = 0; i < ad.text.length; i++) {
                        hash = ((hash << 5) - hash) + ad.text.charCodeAt(i);
                        hash |= 0;
                    }
                    const color = colors[Math.abs(hash) % colors.length];
                    return { ...ad, isPaid: true, color };
                });
            }
        } catch (e) {
            console.warn("Backend unavailable or not configured, using stock ads only.");
        }
        window.adBirdGame = new AdBird('adBirdCanvas', { paidAds });
    };
    initGame();
});
