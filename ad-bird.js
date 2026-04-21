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
            gravity: 0.63, lift: -8, pipeWidth: 110, pipeSpeed: 3.0, bgSpeed: 0.63,
            minGap: 250, maxGap: 350,
            minPipeHeightBottom: 250, minPipeHeightTop: 30,
            bubbleCount: 20, worldShiftInterval: 10, bombCooldown: 20,
            playerImg: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png',
            musicSrc: 'bg-music.mp3', worlds: ['world1.jpg', 'world2.jpg', 'world3.jpg'],
            
            // --- Content ---
            paidAds: options.paidAds || [],
            stockAds: (() => {
                const colors = ["#a855f7", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899", "#f43f5e"];
                return (options.stockAds || window.AdBirdContent.STOCK_ADS).map((text, i) => ({ 
                    text: text.toUpperCase(), 
                    color: colors[i % colors.length]
                }));
            })(),
            maxStockConsecutive: 3,
            hitMessages: window.AdBirdContent.HIT_MESSAGES,
            gameOverMessages: window.AdBirdContent.GAME_OVER_MESSAGES,
            readyMessages: window.AdBirdContent.READY_MESSAGES,
            missMessages: window.AdBirdContent.MISS_MESSAGES,
            megaMissMessages: window.AdBirdContent.MEGA_MISS_MESSAGES,
            msgColors: ["#a855f7", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899", "#f43f5e"],

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
            bombBtn: { x: this.canvas.width - 180, y: 20, w: 160, h: 100, radius: 15 },
            muteBtn: { x: 45, y: this.canvas.height - 60 },
            scoreCenter: this.canvas.width / 2
        };
    }

    _initState() {
        this.state = {
            gameRunning: false, isGameOver: false, loopActive: false,
            score: 0, directHits: 0, totalMisses: 0, lastMissFrame: 0,
            highScore: parseInt(this._safeStorage('get', 'adBirdHighScore')) || 0,
            highDirectHits: parseInt(this._safeStorage('get', 'adBirdHighDirectHits')) || 0,
            highTotalMisses: parseInt(this._safeStorage('get', 'adBirdHighTotalMisses')) || 0,
            frameCount: 0, nextPipeFrame: 40, currentWorld: 0, flashOpacity: 0, isMuted: false, bgX: 0, screenShake: 0,
            bombTimer: 0, isFullscreen: false, assetsLoaded: 0, lastRect: null, waitingForGameOver: false,
            paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], readyMsgBag: [], missMsgBag: [], megaMissMsgBag: [], worldBag: [], stockInARow: 0,
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
            // Transparent to pointer events — but capture one gesture for audio unlock on iOS
            this.overlay.style.pointerEvents = 'none';
            const unlockAudio = () => {
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                window.removeEventListener('touchstart', unlockAudio);
                window.removeEventListener('mousedown', unlockAudio);
            };
            window.addEventListener('touchstart', unlockAudio, { once: true });
            window.addEventListener('mousedown', unlockAudio, { once: true });
        }
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => document.addEventListener(evt, () => { this.state.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement); }));
        this._initBubbles();
        this._loop();
    }

    /* --- INPUT ENGINE --- */

    _handleKeydown(e) {
        if (!this.state.assetsLoaded) return;
        
        // Fullscreen toggle always works
        if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            this.toggleFullscreen();
            return;
        }

        if (this.state.waitingForGameOver) return;

        const isFlap = KEYMAP.flapCodes.includes(e.code) || KEYMAP.flapKeys.includes(e.key), isBomb = KEYMAP.bombCodes.includes(e.code) || KEYMAP.bombKeys.includes(e.key);
        if (isFlap || isBomb) { 
            e.preventDefault(); 
            if (this.state.isGameOver) { this._resetToSplash(); return; }
            if (!this.state.gameRunning) this.start(); 
            else { if (isFlap) this.flap(); if (isBomb) this.dropBomb(); } 
        }
    }

    _handleInput(e) {
        if (!this.state.assetsLoaded) return;
        
        const r = this.state.lastRect || this.canvas.getBoundingClientRect();
        const canvasAspect = this.canvas.width / this.canvas.height;
        const rectAspect = r.width / r.height;
        let dw, dh, dx, dy;
        if (rectAspect > canvasAspect) {
            dh = r.height; dw = dh * canvasAspect; dx = (r.width - dw) / 2; dy = 0;
        } else {
            dw = r.width; dh = dw / canvasAspect; dx = 0; dy = (r.height - dh) / 2;
        }
        const x = Math.max(0, Math.min(this.canvas.width, (e.clientX - (r.left + dx)) * (this.canvas.width / dw)));
        const y = Math.max(0, Math.min(this.canvas.height, (e.clientY - (r.top + dy)) * (this.canvas.height / dh)));
        
        const action = this._hitTest(x, y);
        
        // Fullscreen and mute work regardless of game state
        if (action === 'fullscreen') { this.toggleFullscreen(); return; }
        if (action === 'mute') { this.toggleMute(); return; }

        if (this.state.waitingForGameOver) return;
        
        if (this.state.isGameOver) { this._resetToSplash(); return; }
        
        // If game isn't running, any click (including bomb button) starts it
        if (!this.state.gameRunning) { this.start(); return; }
        
        // Game is running — dispatch normally
        if (action === 'bomb') { this.dropBomb(); return; }
        if (e.button === 2) this.dropBomb();
        else this.flap();
    }

    _hitTest(x, y) {
        if (!this.isMobile && Math.hypot(x - this.ui.fullscreenBtn.x, y - this.ui.fullscreenBtn.y) < 70) return 'fullscreen';
        if (x < 90 && y > this.canvas.height - 90) return 'mute';
        const b = this.ui.bombBtn;
        if (x >= b.x - 20 && x <= b.x + b.w + 20 && y >= b.y - 20 && y <= b.y + b.h + 20) return 'bomb';
        return null;
    }

    /* --- CORE LOOP & PHYSICS --- */

    start() {
        if (this.state.assetsLoaded < this.config.worlds.length + 1) return;
        if (this.overlay) this.overlay.classList.remove('active');
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        Object.assign(this.state, { gameRunning: true, isGameOver: false, waitingForGameOver: false, score: 0, directHits: 0, totalMisses: 0, lastMissFrame: 0, frameCount: 0, nextPipeFrame: 40, bgX: 0, screenShake: 0, bombTimer: 0, paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], missMsgBag: [], megaMissMsgBag: [], stockInARow: 0, particles: [] });
        Object.assign(this.player, { y: 150, velocity: 0, flipAngle: 0, isFlipping: false });
        this.pipes = []; this.bombs = []; this.floatingTexts = [];
        if (this.assets.music && !this.state.isMuted) { this.assets.music.currentTime = 0; this.assets.music.play().catch(() => {}); }
        if (!this.state.loopActive) this._loop();
    }

    _loop() { 
        this.state.loopActive = true; 
        this.state.lastRect = this.canvas.getBoundingClientRect(); 
        this._update(); 
        this._updateParticles(); // Always update particles even when game is paused
        this._draw(); 
        requestAnimationFrame(this._boundLoop); 
    }

    _update() {
        if (this.state.screenShake > 0) this.state.screenShake *= this.config.screenShakeDecay;
        
        if (!this.state.gameRunning) { 
            if (!this.state.isGameOver) {
                this.player.y = 150;
                this.player.velocity = 0;
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

    _updateParticles() {
        for (let i = this.state.particles.length - 1; i >= 0; i--) { 
            const p = this.state.particles[i]; p.x += p.vx; p.y += p.vy; 
            if (p.rotation !== undefined) p.rotation += p.rotSpeed;
            p.vy += this.config.particleGravity * (p.isBit || p.isTurkey ? 1.5 : 1); 
            p.life -= (p.isDeath ? 0.005 : this.config.particleLifeDecay); // Death particles last longer
            if (p.life <= 0) this.state.particles.splice(i, 1); 
        }
        if (this.state.particles.length > 200) {
            this.state.particles.splice(0, this.state.particles.length - 200);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) { 
            const t = this.floatingTexts[i]; t.age++; 
            if (t.vx) t.x += t.vx;
            if (t.age > this.config.floatingTextRiseDelay) { 
                t.vy -= 0.3; t.y += t.vy; t.alpha = Math.max(0, 1 - Math.pow((t.age - this.config.floatingTextRiseDelay) / 40, 2)); 
            } 
            if (t.alpha <= 0 || t.age > this.config.floatingTextMaxAge) this.floatingTexts.splice(i, 1); 
        }
    }

    _updateEntities() {
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i]; p.x -= this.config.pipeSpeed;
            if (p.highlight > 0) p.highlight *= 0.82;
            p.stains.forEach(s => s.drips.forEach(d => { if (d.len < d.maxLen) d.len += d.speed; }));
            const pd = 15; const bx = this.player.x+pd, bw = this.player.w-(pd*2), by = this.player.y+pd, bh = this.player.h-(pd*2);
            if (bx < p.x+p.w && bx+bw > p.x && (by < p.y || by+bh > p.y+p.gap)) { this.gameOver(); return; }
            if (!p.scored && p.x + p.w < this.player.x) { 
                p.scored = true; p.highlight = 1.0; this.state.score++; this.playSound('score'); 
                if (this.state.score % this.config.worldShiftInterval === 0) this._shiftWorld(); 
            }
            if (p.x + p.w < -150) this.pipes.splice(i, 1);
        }
        for (let i = this.bombs.length - 1; i >= 0; i--) { 
            const b = this.bombs[i]; b.y += b.speed; let hit = false; 
            for (const p of this.pipes) { 
                if (b.x > p.x && b.x < p.x + p.w && (b.y < p.y || b.y > p.y + p.gap)) { 
                    this._createSplat(p, b.x, b.y, b.scale); 
                    hit = true; break; 
                } 
            } if (hit) this.bombs.splice(i, 1);
            else if (b.y > this.canvas.height) {
                // MISS!
                const isGiga = b.scale >= 5.0;
                const msg = isGiga ? this._nextFromBag('megaMissMsgBag', 'megaMissMessages') : this._nextFromBag('missMsgBag', 'missMessages');
                
                // Spatial Stacking (Find the highest text in this specific X-lane)
                let targetY = this.canvas.height - 30;
                this.floatingTexts.forEach(t => {
                    if (Math.abs(t.x - b.x) < 150 && t.y < this.canvas.height && t.y > this.canvas.height - 300) {
                        targetY = Math.min(targetY, t.y - (isGiga ? 50 : 35));
                    }
                });
                
                this.floatingTexts.push({ 
                    x: b.x, y: targetY, text: msg, 
                    color: "#9ca3af", age: 0, alpha: 1, vy: -0.5, vx: (Math.random() - 0.5) * 2,
                    scale: isGiga ? 1.4 : 0.8, align: "center", 
                    isMega: isGiga, glow: isGiga ? "#4b5563" : null,
                    isShivering: isGiga
                });

                // SPLASH PARTICLES
                const pCount = isGiga ? 45 : 12;
                for (let j = 0; j < pCount; j++) {
                    this.state.particles.push({
                        x: b.x, y: this.canvas.height,
                        vx: (Math.random() - 0.5) * (isGiga ? 12 : 6),
                        vy: (Math.random() - 1.0) * (isGiga ? 25 : 12),
                        size: Math.random() * 5 + 2,
                        color: Math.random() > 0.5 ? "#60a5fa" : "#fff",
                        life: 1.0
                    });
                }

                if (isGiga) this.state.screenShake = 30;
                this.state.totalMisses++;
                this.state.lastMissFrame = this.state.frameCount;
                this.playSound(isGiga ? 'mega_miss' : 'miss');
                this.bombs.splice(i, 1);
            }
        }
        this.bubbles.forEach(b => { b.x -= b.speed; if (b.x < -10) b.x = this.canvas.width + 10; });
    }

    _spawnPipe() {
        const ad = this._nextAd();
        const gap = Math.floor(Math.random() * (this.config.maxGap - this.config.minGap)) + this.config.minGap;
        const minH_top = this.config.minPipeHeightTop;
        const maxH_top = this.canvas.height - gap - this.config.minPipeHeightBottom;
        const h = Math.floor(Math.random() * (maxH_top - minH_top)) + minH_top;
        this.pipes.push({ x: this.canvas.width, y: h, w: this.config.pipeWidth, gap: gap, ad: ad, scored: false, highlight: 0, stains: [] });
        this.state.nextPipeFrame = this.state.frameCount + Math.floor(Math.random() * 80) + 80;
    }

    /* --- RENDERING --- */

    _draw() {
        this.ctx.save(); if (this.state.screenShake > 0.5) this.ctx.translate((Math.random()-0.5)*this.state.screenShake, (Math.random()-0.5)*this.state.screenShake);
        this.ctx.clearRect(-40, -40, this.canvas.width+80, this.canvas.height+80);
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
        this.ctx.save();
        if (p.highlight > 0.1) {
            this.ctx.shadowBlur = 12 * p.highlight;
            this.ctx.shadowColor = "#fff";
            this.ctx.fillStyle = `rgba(255, 255, 255, ${p.highlight})`;
            this.ctx.fillRect(p.x - bW - 2, 0, bW + 4, p.y);
            this.ctx.fillRect(p.x + p.w - 2, 0, bW + 4, p.y);
            this.ctx.fillRect(p.x - bW - 2, p.y + p.gap, bW + 4, this.canvas.height);
            this.ctx.fillRect(p.x + p.w - 2, p.y + p.gap, bW + 4, this.canvas.height);
        }
        this.ctx.fillStyle = gc;
        this.ctx.fillRect(p.x - bW, 0, bW, p.y);
        this.ctx.fillRect(p.x + p.w, 0, bW, p.y);
        this.ctx.fillRect(p.x - bW, p.y + p.gap, bW, this.canvas.height);
        this.ctx.fillRect(p.x + p.w, p.y + p.gap, bW, this.canvas.height);
        this.ctx.restore();
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
        // --- MAIN SCORE: EPIC & GLOWING ---
        this.ctx.save();
        this.ctx.fillStyle = "#fff";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "alphabetic";
        this.ctx.font = "900 72px 'Outfit', sans-serif";
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 4; 
        this.ctx.strokeText(this.state.score, this.ui.scoreCenter, 70);
        this.ctx.fillText(this.state.score, this.ui.scoreCenter, 70);
        this.ctx.restore();

        // --- TOP LEFT DASHBOARD: IMPACT & MISSES ---
        this.ctx.save();
        const padding = 25;
        
        // IMPACT
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "top";
        this.ctx.font = "bold 14px 'Outfit', sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 2;
        this.ctx.strokeText("MARKETING IMPACT", padding, padding);
        this.ctx.fillText("MARKETING IMPACT", padding, padding);
        
        this.ctx.font = "bold 38px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fff";
        this.ctx.shadowBlur = 18;
        this.ctx.shadowColor = "#06b6d4";
        this.ctx.strokeText(this.state.directHits, padding, padding + 20);
        this.ctx.fillText(this.state.directHits, padding, padding + 20);
        
        // MISSES
        const missY = padding + 80;
        this.ctx.save();
        this.ctx.translate(padding, missY);
        const mPop = (this.state.lastMissFrame && this.state.frameCount - this.state.lastMissFrame < 15) ? 1.2 : 1.0;
        this.ctx.scale(mPop, mPop);
        
        this.ctx.font = "bold 14px 'Outfit', sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.shadowBlur = 0;
        this.ctx.strokeText("CAMPAIGN MISSES", 0, 0);
        this.ctx.fillText("CAMPAIGN MISSES", 0, 0);
        
        this.ctx.font = "bold 38px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fff";
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = "#f43f5e"; 
        this.ctx.strokeText(this.state.totalMisses, 0, 20);
        this.ctx.fillText(this.state.totalMisses, 0, 20);
        this.ctx.restore();
        
        this.ctx.restore();

        this.ctx.font = "24px serif"; this.ctx.textAlign = "left"; this.ctx.textBaseline = "middle"; this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.ui.muteBtn.x, this.ui.muteBtn.y);
        if (!this.isMobile) {
            const fs = this.ui.fullscreenBtn; this.ctx.save(); this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)"; this.ctx.beginPath(); this.ctx.arc(fs.x, fs.y, fs.radius, 0, Math.PI * 2); this.ctx.fill(); this.ctx.font = "bold 54px serif"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; this.ctx.fillText("⤢", fs.x, fs.y + 4); this.ctx.restore();
        }
        const b = this.ui.bombBtn; this.ctx.save(); this.ctx.fillStyle = this.state.bombTimer > 0 ? "rgba(255, 255, 255, 0.15)" : "rgba(6, 182, 212, 0.6)"; this.ctx.shadowBlur = 15; this.ctx.shadowColor = "#06b6d4"; this.ctx.beginPath(); this.ctx.roundRect(b.x, b.y, b.w, b.h, b.radius); this.ctx.fill();
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.font = "bold 32px 'Outfit', sans-serif"; this.ctx.shadowBlur = 0; this.ctx.fillText("BOMB", b.x + b.w/2, b.y + b.h/2 - (this.isMobile ? 0 : 8)); 
        if (!this.isMobile) { this.ctx.font = "bold 11px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; this.ctx.fillText("(SHIFT / R-CLICK)", b.x + b.w/2, b.y + b.h/2 + 22); } 
        if (this.state.bombTimer > 0) { 
            const inset = b.radius;
            const maxBarWidth = b.w - (inset * 2);
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; 
            this.ctx.fillRect(b.x + inset, b.y + b.h - 4, maxBarWidth * (this.state.bombTimer / this.config.bombCooldown), 4); 
        } 
        this.ctx.restore();
    }

    /* --- ENTROPY & AD ENGINE --- */

    _shuffle(array) {
        if (!array || !Array.isArray(array)) return [];
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
            scale: isMega ? 1.4 : 1, vx: (Math.random()-0.5)*(isMega ? 4 : 2),
            text: hitMsg, 
            color: isMega ? "#fff" : this.config.msgColors[Math.floor(Math.random()*this.config.msgColors.length)],
            glow: isMega ? p.ad.color : null,
            isMega: isMega,
            align: align
        }); 
        this.playSound('splat'); 
    }

    gameOver() { 
        if (this.state.isGameOver || this.state.waitingForGameOver) return; 
        this.state.waitingForGameOver = true;
        this.state.gameRunning = false; 
        
        const force = Math.random() * 1.6 + 0.2; // Variability from 0.2 to 1.8
        this.state.screenShake = 10 + (force * 20); 
        
        // BLOODY EXPLOSION (Dynamic Force)
        const meats = ["🍗", "🍖"];
        for (let i = 0; i < 65; i++) {
            const isBit = i < 15;
            const isTurkey = i < 8; 
            this.state.particles.push({
                x: this.player.x + this.player.w/2,
                y: this.player.y + this.player.h/2,
                vx: (Math.random() - 0.5) * 10 * force,
                vy: (Math.random() - 0.7) * 14 * force,
                size: isBit ? Math.random() * 18 + 12 : Math.random() * 6 + 3,
                color: Math.random() > 0.3 ? "#ff0000" : "#8b0000",
                life: 1.0,
                isBit: isBit,
                isTurkey: isTurkey,
                emoji: meats[Math.floor(Math.random() * meats.length)],
                isDeath: true,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2 * force
            });
        }

        this.playSound('death'); 
        if (this.assets.music) this.assets.music.pause(); 

        setTimeout(() => {
            this.state.isGameOver = true; 
            this.state.waitingForGameOver = false;
            this.state.deathMsg = this._nextFromBag('gameOverMsgBag', 'gameOverMessages');
            this.floatingTexts = []; // Clear floating texts so they don't block the score
            if (this.state.score > this.state.highScore) { 
                this.state.highScore = this.state.score; 
                this._safeStorage('set', 'adBirdHighScore', this.state.highScore); 
            } 
            if (this.state.directHits > this.state.highDirectHits) { 
                this.state.highDirectHits = this.state.directHits; 
                this._safeStorage('set', 'adBirdHighDirectHits', this.state.highDirectHits); 
            } 
            if (this.state.totalMisses > this.state.highTotalMisses) {
                this.state.highTotalMisses = this.state.totalMisses;
                this._safeStorage('set', 'adBirdHighTotalMisses', this.state.highTotalMisses);
            }
            if (this.isMobile && this.overlay) this.overlay.classList.add('active'); 
        }, 1000);
    }

    /* --- HELPERS --- */

    playSound(type) { 
        if (this.state.isMuted) return; 
        if (type === 'splat') this._playSplat();
        else if (type === 'death') this._playDeath();
        else if (type === 'miss') this._playWhistle();
        else if (type === 'mega_miss') this._playMegaWhistle();
        else if (this.config._toneConfigs[type]) this._playTone(this.config._toneConfigs[type]);
    }

    _playWhistle() {
        this._playTone({ type: 'sine', freq: [1200, 200], vol: 0.3, dur: 0.8 });
    }

    _playMegaWhistle() {
        this._playTone({ type: 'sine', freq: [800, 100], vol: 0.5, dur: 1.2 });
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
        // Messy bloody splat sound (Noise + Squelch)
        try {
            const dur = 0.5;
            const buffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * dur, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for(let i=0; i<data.length; i++) data[i] = Math.random() * 2 - 1;
            
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;
            
            const gain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + dur);
            
            gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + dur);
            
            noise.connect(filter); filter.connect(gain); gain.connect(this.audioCtx.destination);
            noise.start();
            
            // Add a low-end thump
            this._playTone({ type: 'sawtooth', freq: [150, 40], vol: 0.3, dur: 0.4 });
        } catch(e) {}
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
        if (this.state.isGameOver) return; // EXPLODED!
        this.ctx.save(); 
        this.ctx.translate(this.player.x+this.player.w/2, this.player.y+this.player.h/2); 
        this.ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/4, this.player.velocity * this.config.birdRotationFactor)) + this.player.flipAngle); 
        this.ctx.scale(-1, 1); 
        this.ctx.drawImage(this.assets.player, -this.player.w/2, -this.player.h/2, this.player.w, this.player.h); 
        this.ctx.restore(); 
    }
    _renderParticles() { 
        this.state.particles.forEach(p => { 
            this.ctx.globalAlpha = p.life; 
            this.ctx.fillStyle = p.color; 
            if (p.isTurkey) {
                this.ctx.save();
                this.ctx.shadowBlur = 0;
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);
                this.ctx.font = `${p.size + 20}px serif`;
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(p.emoji || "🍗", 0, 0);
                this.ctx.restore();
            } else if (p.isBit) {
                this.ctx.save();
                this.ctx.shadowBlur = 0;
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);
                // Draw a jagged bit
                this.ctx.beginPath();
                this.ctx.moveTo(-p.size/2, -p.size/2);
                this.ctx.lineTo(p.size/2, -p.size/4);
                this.ctx.lineTo(p.size/3, p.size/2);
                this.ctx.lineTo(-p.size/3, p.size/3);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.restore();
            } else {
                this.ctx.shadowBlur = p.isMega ? 15 : 0; 
                if (p.isMega) this.ctx.shadowColor = p.color;
                this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI*2); this.ctx.fill(); 
            }
        }); 
        this.ctx.globalAlpha = 1; this.ctx.shadowBlur = 0; 
    }
    _renderFloatingTexts() { 
        this.floatingTexts.forEach(t => { 
            this.ctx.save(); 
            this.ctx.textAlign = t.align || "center"; 
            this.ctx.globalAlpha = t.alpha; 
            
            let tx = t.x, ty = t.y;
            if (t.isShivering) {
                tx += (Math.random() - 0.5) * 4;
                ty += (Math.random() - 0.5) * 4;
            }
            this.ctx.translate(tx, ty); 
            
            const pulseScale = t.isMega ? t.scale * (1 + Math.sin(t.age * 0.2) * 0.1) : t.scale;
            this.ctx.scale(pulseScale, pulseScale); 
            this.ctx.font = t.isMega ? "900 38px 'Outfit', sans-serif" : "bold 32px 'Outfit', sans-serif"; 
            if (t.glow) { this.ctx.shadowBlur = 25; this.ctx.shadowColor = t.glow; }
            this.ctx.strokeStyle = "#000"; this.ctx.lineWidth = t.isMega ? 3 : 1.5; this.ctx.strokeText(t.text, 0, 0); 
            this.ctx.fillStyle = t.color; this.ctx.fillText(t.text, 0, 0); 
            this.ctx.restore(); 
        }); 
    }
    _renderGameOverScreen() { 
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.9)"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); 
        
        this.ctx.fillStyle = "#fff"; 
        this.ctx.font = "bold 36px 'Outfit', sans-serif"; 
        this.ctx.textAlign = "center"; 
        this.ctx.textBaseline = "alphabetic"; 
        this.ctx.fillText(this.state.deathMsg, this.canvas.width / 2, this.canvas.height / 2 - 110); 

        const stats = [
            { label: "MARKET REACH", val: this.state.score, high: this.state.highScore, color: "#fbbf24" },
            { label: "MARKETING IMPACT", val: this.state.directHits, high: this.state.highDirectHits, color: "#06b6d4" },
            { label: "CAMPAIGN MISSES", val: this.state.totalMisses, high: this.state.highTotalMisses, color: "#f43f5e" }
        ];

        stats.forEach((s, i) => {
            const sy = this.canvas.height / 2 - 40 + (i * 75);
            this.ctx.font = "bold 14px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            this.ctx.fillText(s.label, this.canvas.width / 2, sy);
            
            this.ctx.font = "900 42px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fff";
            this.ctx.fillText(s.val, this.canvas.width / 2, sy + 38);
            
            this.ctx.font = "bold 12px 'Outfit', sans-serif";
            this.ctx.fillStyle = s.color;
            this.ctx.fillText("BEST: " + s.high, this.canvas.width / 2, sy + 58);
        });

        this.ctx.fillStyle = "rgba(255,255,255,0.5)"; 
        this.ctx.font = "14px 'Outfit', sans-serif"; 
        this.ctx.fillText(this.isMobile ? "TAP to continue" : "SPACE or CLICK to continue", this.canvas.width / 2, this.canvas.height / 2 + 200); 
    }
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
        this.state.score = 0;
        this.state.directHits = 0;
        this.state.totalMisses = 0;
        this.state.lastMissFrame = 0;
        
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
        else if (!this.state.gameRunning && !this.state.waitingForGameOver) this._renderStartScreen(); 
    }
    _initBubbles() { this.bubbles = Array.from({ length: 20 }, () => ({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, size: Math.random() * 3 + 1, speed: Math.random() * 0.5 + 0.2 })); }
}

document.addEventListener('DOMContentLoaded', () => {
    const initGame = async () => {
        let paidAds = [];
        const SUPABASE_URL = 'https://agbtvbymknayxrebochn.supabase.co'; 
        const SUPABASE_KEY = 'sb_publishable_8yipwhYLiM19LVR8qLXT6A_MOD1YTl1';
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/ads?select=text,color&is_paid=eq.true&status=eq.approved&expires_at=gt.now()`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (response.ok) {
                const data = await response.json();
                const colors = ['#a855f7', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899', '#f43f5e'];
                paidAds = data.map(ad => {
                    // Hash the ad text to pick a stable color
                    let hash = 0;
                    for (let i = 0; i < ad.text.length; i++) {
                        hash = ((hash << 5) - hash) + ad.text.charCodeAt(i);
                        hash |= 0;
                    }
                    const color = ad.color || colors[Math.abs(hash) % colors.length];
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
