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
                return (options.stockAds || window.AdBirdContent.STOCK_ADS).map(text => {
                    // Hash the ad text for stable color across sessions
                    let hash = 0;
                    for (let i = 0; i < text.length; i++) {
                        hash = ((hash << 5) - hash) + text.charCodeAt(i);
                        hash |= 0;
                    }
                    return { 
                        text: text.toUpperCase(), 
                        color: colors[Math.abs(hash) % colors.length]
                    };
                });
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
            floatingTextMaxAge: 73,

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
        // Top-right stack: two small circular buttons side-by-side above bomb
        const smallBtnR = 25;
        const smallBtnY = 40;
        const bombY = 85;
        this.ui = {
            fullscreenBtn: { x: this.canvas.width - 110, y: smallBtnY, radius: smallBtnR },
            muteBtn: { x: this.canvas.width - 50, y: smallBtnY, radius: smallBtnR },
            bombBtn: { x: this.canvas.width - 180, y: bombY, w: 160, h: 100, radius: 15 },
            scoreCenter: this.canvas.width / 2
        };
    }

    _initState() {
        this.state = {
            gameRunning: false, isGameOver: false,
            score: 0, directHits: 0, totalMisses: 0, lastMissFrame: 0,
            highScore: parseInt(this._safeStorage('get', 'adBirdHighScore')) || 0,
            highDirectHits: parseInt(this._safeStorage('get', 'adBirdHighDirectHits')) || 0,
            highTotalMisses: parseInt(this._safeStorage('get', 'adBirdHighTotalMisses')) || 0,
            frameCount: 0, nextPipeFrame: 40, currentWorld: 0, flashOpacity: 0, isMuted: false, bgX: 0, screenShake: 0,
            bombTimer: 0, assetsLoaded: 0, lastRect: null, waitingForGameOver: false, gameOverFrame: 0,
            mouseX: 0, mouseY: 0, runItBackHover: false, runItBackPressed: 0,
            splashFocus: 0, playBtnHover: false, rentBtnHover: false, playBtnPressed: 0, rentBtnPressed: 0,
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
        it.addEventListener('mousemove', (e) => { if (!this.isMobile) this._handleMouseMove(e); });
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
        this.state.lastRect = this.canvas.getBoundingClientRect();
        this._initMidground();
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

        const isFlap = KEYMAP.flapCodes.includes(e.code) || KEYMAP.flapKeys.includes(e.key);
        const isBomb = KEYMAP.bombCodes.includes(e.code) || KEYMAP.bombKeys.includes(e.key);
        const isEnter = e.code === 'Enter' || e.key === 'Enter';
        const isLeft = e.code === 'ArrowLeft' || e.key === 'ArrowLeft';
        const isRight = e.code === 'ArrowRight' || e.key === 'ArrowRight';

        // Game-over screen handling
        if (this.state.isGameOver) {
            if (isFlap || isBomb || isEnter) {
                e.preventDefault();
                this._triggerButtonExplosion();
                this._resetToSplash();
            }
            return;
        }

        // Splash screen — Option A keyboard nav
        if (!this.state.gameRunning) {
            // Arrow keys shift focus between the two buttons
            if (isLeft || isRight) {
                e.preventDefault();
                this.state.splashFocus = this.state.splashFocus === 0 ? 1 : 0;
                this.playSound('score');
                return;
            }
            // Enter or Space activates the focused button
            if (isEnter || e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                if (this.state.splashFocus === 0) {
                    // PLAY
                    this._triggerSplashButtonExplosion('play');
                    setTimeout(() => this.start(), 300);
                } else {
                    // RENT
                    this._triggerSplashButtonExplosion('rent');
                    setTimeout(() => {
                        window.open('https://buy.stripe.com/9B6aEX0jdgOV8iq7sDcbC00', '_blank');
                    }, 300);
                }
                return;
            }
            return;
        }

        // Game is running — normal controls
        if (isFlap || isBomb) {
            e.preventDefault();
            if (isFlap) this.flap();
            if (isBomb) this.dropBomb();
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
        
        if (this.state.isGameOver) {
            // Mobile: tap anywhere to reset. Desktop: must hit the button.
        // Splash screen — only buttons register, not the whole screen
        if (!this.state.gameRunning) { 
            if (this._isOverPlayBtn(x, y)) {
                this._triggerSplashButtonExplosion('play');
                // Delay start slightly so the player sees the explosion
                setTimeout(() => this.start(), 300);
                return;
            }
            if (this._isOverRentBtn(x, y)) {
                this._triggerSplashButtonExplosion('rent');
                // Open Stripe after the animation plays
                setTimeout(() => {
                    window.open('https://buy.stripe.com/9B6aEX0jdgOV8iq7sDcbC00', '_blank');
                }, 300);
                return;
            }
            // Empty-space clicks do nothing
            return; 
        }
        
        // Game is running — dispatch normally
        if (action === 'bomb') { this.dropBomb(); return; }
        if (e.button === 2) this.dropBomb();
        else this.flap();
    }

    _handleMouseMove(e) {
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
        
        this.state.mouseX = x;
        this.state.mouseY = y;
        
        // Update hover state for cursor change
        const hoveringRunBack = this._isOverRunItBack(x, y);
        const hoveringPlay = this._isOverPlayBtn(x, y);
        const hoveringRent = this._isOverRentBtn(x, y);

        this.state.runItBackHover = hoveringRunBack;
        this.state.playBtnHover = hoveringPlay;
        this.state.rentBtnHover = hoveringRent;

        // If hovering a splash button, shift focus to it
        if (hoveringPlay) this.state.splashFocus = 0;
        else if (hoveringRent) this.state.splashFocus = 1;

        this.canvas.style.cursor = (hoveringRunBack || hoveringPlay || hoveringRent) ? 'pointer' : 'default';
    }

    _isOverRunItBack(x, y) {
        if (!this.state.isGameOver) return false;
        
        const btnW = 280;
        const btnH = 64;
        const btnX = (this.canvas.width - btnW) / 2;
        const btnY = this.canvas.height / 2 + 180;
        
        return x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH;
    }
    _isOverRentBtn(x, y) {
        if (this.state.gameRunning || this.state.isGameOver) return false;
        if (!this._rentBtnRect) return false;
        const r = this._rentBtnRect;
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }
    _isOverPlayBtn(x, y) {
        if (this.state.gameRunning || this.state.isGameOver) return false;
        if (!this._playBtnRect) return false;
        const r = this._playBtnRect;
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    _triggerSplashButtonExplosion(which) {
        // which: 'play' or 'rent'
        const rect = which === 'play' ? this._playBtnRect : this._rentBtnRect;
        if (!rect) return;
        
        if (which === 'play') this.state.playBtnPressed = this.state.frameCount;
        else this.state.rentBtnPressed = this.state.frameCount;
        
        this.state.screenShake = 25;
        
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        
        // Fireworks-style burst: two rings of particles + sparkles
        const burstColors = which === 'play' 
            ? ["#06b6d4", "#3b82f6", "#22d3ee", "#fff", "#a855f7"]
            : ["#f59e0b", "#ec4899", "#fbbf24", "#fff", "#f43f5e"];
        
        // Outer ring — fast and wide
        for (let i = 0; i < 40; i++) {
            const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.15;
            const speed = Math.random() * 18 + 10;
            this.state.particles.push({
                x: cx + (Math.random() - 0.5) * rect.w * 0.6,
                y: cy + (Math.random() - 0.5) * rect.h * 0.6,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                size: Math.random() * 4 + 2,
                color: burstColors[Math.floor(Math.random() * burstColors.length)],
                life: 1.0,
                isMega: true
            });
        }
        
        // Inner sparkle cloud — slower, brighter
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 2;
            this.state.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: Math.random() * 6 + 3,
                color: "#fff",
                life: 1.0 + Math.random() * 0.5,
                isMega: true
            });
        }
        
        this.playSound('shift');
    }

    _hitTest(x, y) {
        const fs = this.ui.fullscreenBtn;
        if (Math.hypot(x - fs.x, y - fs.y) < fs.radius + 8) return 'fullscreen';
        const m = this.ui.muteBtn;
        if (Math.hypot(x - m.x, y - m.y) < m.radius + 8) return 'mute';
        const b = this.ui.bombBtn;
        if (x >= b.x - 20 && x <= b.x + b.w + 20 && y >= b.y - 20 && y <= b.y + b.h + 20) return 'bomb';
        return null;
    }

    /* --- CORE LOOP & PHYSICS --- */

    start() {
        if (this.state.assetsLoaded < this.config.worlds.length + 1) return;
        if (this.overlay) this.overlay.classList.remove('active');
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        Object.assign(this.state, { gameRunning: true, isGameOver: false, waitingForGameOver: false, score: 0, directHits: 0, totalMisses: 0, lastMissFrame: 0, frameCount: 0, nextPipeFrame: 40, bgX: 0, screenShake: 0, bombTimer: 0, paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], missMsgBag: [], megaMissMsgBag: [], stockInARow: 0, particles: [], gameOverFrame: 0, runItBackHover: false, runItBackPressed: 0, playBtnHover: false, rentBtnHover: false, playBtnPressed: 0, rentBtnPressed: 0 });
        this.canvas.style.cursor = 'default';
        Object.assign(this.player, { y: 150, velocity: 0, flipAngle: 0, isFlipping: false });
        this.pipes = []; this.bombs = []; this.floatingTexts = [];
        if (this.assets.music && !this.state.isMuted) { this.assets.music.currentTime = 0; this.assets.music.play().catch(() => {}); }
    }

    _loop() { 
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
            this.state.frameCount++;
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
                
                // Stack miss text above any nearby existing floating texts in the same area
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
        this.bubbles.forEach(b => { 
            b.x -= b.speed; 
            b.bobPhase += b.bobSpeed;
            if (b.x < -20) { 
                b.x = this.canvas.width + 20; 
                b.y = Math.random() * this.canvas.height;  // Rerandomize y on respawn
            } 
        });
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
        this._renderWorld(); this._renderMidground(); this._renderPipes(); this._renderBombs(); 
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
        
        // Mute button — circular, top right
        const m = this.ui.muteBtn;
        this.ctx.save();
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)";
        this.ctx.beginPath();
        this.ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.font = "22px serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", m.x, m.y + 1);
        this.ctx.restore();

        // Fullscreen button — circular, top right
        const fs = this.ui.fullscreenBtn;
        this.ctx.save();
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)";
        this.ctx.beginPath();
        this.ctx.arc(fs.x, fs.y, fs.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.font = "bold 28px serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillText("⤢", fs.x, fs.y + 2);
        this.ctx.restore();

        const b = this.ui.bombBtn; this.ctx.save(); this.ctx.fillStyle = this.state.bombTimer > 0 ? "rgba(255, 255, 255, 0.15)" : "rgba(6, 182, 212, 0.6)"; this.ctx.shadowBlur = 15; this.ctx.shadowColor = "#06b6d4"; this.ctx.beginPath(); this.ctx.roundRect(b.x, b.y, b.w, b.h, b.radius); this.ctx.fill();
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.font = "bold 32px 'Outfit', sans-serif"; this.ctx.shadowBlur = 0; this.ctx.fillText("BOMB", b.x + b.w/2, b.y + b.h/2 - (this.isMobile ? 0 : 8)); 
        if (!this.isMobile) { this.ctx.font = "bold 11px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; this.ctx.fillText("(SHIFT / R-CLICK)", b.x + b.w/2, b.y + b.h/2 + 22); } 
        if (this.state.bombTimer > 0) { 
            const inset = b.radius;
            const maxBarWidth = b.w - (inset * 2);
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; 
            this.ctx.beginPath();
            this.ctx.roundRect(b.x + inset, b.y + b.h - 4, maxBarWidth * (this.state.bombTimer / this.config.bombCooldown), 4, 2); 
            this.ctx.fill();
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
            this.state.gameOverFrame = this.state.frameCount;
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
            
            // Pulse scale (for mega texts)
            let pulseScale = t.isMega ? t.scale * (1 + Math.sin(t.age * 0.2) * 0.1) : t.scale;
            
            // Width guard — shrink mega texts to fit 90% of canvas width
            this.ctx.font = t.isMega ? "900 38px 'Outfit', sans-serif" : "bold 32px 'Outfit', sans-serif"; 
            const textW = this.ctx.measureText(t.text).width;
            const maxW = this.canvas.width * 0.9;
            const scaledW = textW * pulseScale;
            if (scaledW > maxW) {
                pulseScale *= maxW / scaledW;
            }
            
            this.ctx.scale(pulseScale, pulseScale); 
            if (t.glow) { this.ctx.shadowBlur = 25; this.ctx.shadowColor = t.glow; }
            this.ctx.strokeStyle = "#000"; this.ctx.lineWidth = t.isMega ? 3 : 1.5; this.ctx.strokeText(t.text, 0, 0); 
            this.ctx.fillStyle = t.color; this.ctx.fillText(t.text, 0, 0); 
            this.ctx.restore(); 
        }); 
    }
    _renderGameOverScreen() { 
        const t = Math.max(0, this.state.frameCount - this.state.gameOverFrame);
        
        const ease = (elapsed, duration) => {
            const p = Math.min(1, Math.max(0, elapsed / duration));
            return 1 - Math.pow(1 - p, 3);
        };

        // Dark overlay
        const overlayAlpha = ease(t, 15) * 0.9;
        this.ctx.fillStyle = `rgba(10, 10, 15, ${overlayAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); 
        
        // Death message
        const deathT = Math.max(0, t - 10);
        const deathProgress = ease(deathT, 20);
        const deathOffset = (1 - deathProgress) * -80;
        
        if (deathProgress > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = deathProgress;
            this.ctx.fillStyle = "#fff"; 
            this.ctx.font = "900 52px 'Outfit', sans-serif"; 
            this.ctx.textAlign = "center"; 
            this.ctx.textBaseline = "alphabetic"; 
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = "rgba(244, 63, 94, 0.6)";
            this.ctx.strokeStyle = "#000";
            this.ctx.lineWidth = 4;
            this.ctx.strokeText(this.state.deathMsg, this.canvas.width / 2, this.canvas.height / 2 - 200 + deathOffset); 
            this.ctx.fillText(this.state.deathMsg, this.canvas.width / 2, this.canvas.height / 2 - 200 + deathOffset); 
            this.ctx.restore();
        }
        
        // Subtitle
        if (deathProgress > 0.3) {
            this.ctx.save();
            this.ctx.globalAlpha = (deathProgress - 0.3) / 0.7;
            this.ctx.font = "bold 14px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            this.ctx.textAlign = "center";
            this.ctx.fillText("— CAMPAIGN TERMINATED —", this.canvas.width / 2, this.canvas.height / 2 - 160);
            this.ctx.restore();
        }

        // Stats cards
        const stats = [
            { label: "MARKET REACH", val: this.state.score, high: this.state.highScore, color: "#fbbf24", rgb: "251, 191, 36" },
            { label: "MARKETING IMPACT", val: this.state.directHits, high: this.state.highDirectHits, color: "#06b6d4", rgb: "6, 182, 212" },
            { label: "CAMPAIGN MISSES", val: this.state.totalMisses, high: this.state.highTotalMisses, color: "#f43f5e", rgb: "244, 63, 94" }
        ];

        const cardW = 210;
        const cardH = 210;
        const cardGap = 20;
        const totalW = (cardW * 3) + (cardGap * 2);
        const startX = (this.canvas.width - totalW) / 2;
        const cardY = this.canvas.height / 2 - 80;

        stats.forEach((s, i) => {
            const cardT = Math.max(0, t - 30 - (i * 8));
            const cardProgress = ease(cardT, 25);
            
            if (cardProgress <= 0) return;
            
            const cardOffset = (1 - cardProgress) * 40;
            const cardX = startX + (i * (cardW + cardGap));
            const cY = cardY + cardOffset;
            const isNewRecord = s.val > 0 && s.val >= s.high;
            
            this.ctx.save();
            this.ctx.globalAlpha = cardProgress;
            
            // Card background
            this.ctx.fillStyle = `rgba(${s.rgb}, 0.08)`;
            this.ctx.beginPath();
            this.ctx.roundRect(cardX, cY, cardW, cardH, 16);
            this.ctx.fill();
            
            // Card border with glow
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = s.color;
            this.ctx.strokeStyle = s.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(cardX, cY, cardW, cardH, 16);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // Label
            this.ctx.font = "bold 14px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "alphabetic";
            this.ctx.fillText(s.label, cardX + cardW / 2, cY + 30);

            // Big value
            this.ctx.font = "900 64px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fff";
            this.ctx.textBaseline = "middle";
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = s.color;
            this.ctx.fillText(s.val, cardX + cardW / 2, cY + 90);
            this.ctx.shadowBlur = 0;

            // Progress bar
            const barMax = Math.max(s.high, s.val, 1);
            const barFillRatio = Math.min(1, s.val / barMax);
            const barW = cardW - 40;
            const barH = 6;
            const barX = cardX + 20;
            const barY = cY + 140;
            
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            this.ctx.beginPath();
            this.ctx.roundRect(barX, barY, barW, barH, 3);
            this.ctx.fill();
            
            this.ctx.fillStyle = s.color;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = s.color;
            this.ctx.beginPath();
            this.ctx.roundRect(barX, barY, barW * barFillRatio * cardProgress, barH, 3);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // BEST line
            this.ctx.font = "bold 14px 'Outfit', sans-serif";
            this.ctx.fillStyle = s.color;
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "alphabetic";
            this.ctx.fillText("BEST  " + s.high, cardX + cardW / 2, cY + cardH - 20);

            this.ctx.restore();

            // NEW RECORD badge
            if (isNewRecord && s.val > 0 && cardProgress > 0.7) {
                const badgeT = Math.max(0, cardT - 18);
                const badgeProgress = ease(badgeT, 15);
                const badgeScale = 0.6 + (badgeProgress * 0.4);
                const badgePulse = 1 + Math.sin(this.state.frameCount * 0.15) * 0.05;
                const finalScale = badgeScale * badgePulse;
                
                const badgeW = 110;
                const badgeH = 24;
                const badgeCX = cardX + cardW / 2;
                const badgeCY = cY - 10 + badgeH / 2;
                
                this.ctx.save();
                this.ctx.globalAlpha = badgeProgress;
                this.ctx.translate(badgeCX, badgeCY);
                this.ctx.scale(finalScale, finalScale);
                
                this.ctx.fillStyle = s.color;
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = s.color;
                this.ctx.beginPath();
                this.ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 12);
                this.ctx.fill();
                
                this.ctx.shadowBlur = 0;
                this.ctx.font = "900 12px 'Outfit', sans-serif";
                this.ctx.fillStyle = "#0a0a0c";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText("NEW RECORD", 0, 0);
                this.ctx.restore();
            }
        });

        // RUN IT BACK button with entrance animation
        const btnT = Math.max(0, t - 70);
        const btnProgress = ease(btnT, 20);
        
        if (btnProgress > 0) {
            const btnW = 280;
            const btnH = 64;
            const btnX = (this.canvas.width - btnW) / 2;
            const btnYBase = this.canvas.height / 2 + 180 + ((1 - btnProgress) * 20);
            const btnRadius = 14;
            
            // Hover lift
            const hoverLift = this.state.runItBackHover ? 4 : 0;
            const btnY = btnYBase - hoverLift;
            
            // Click compression — button briefly squishes down and fades out on click
            const framesSincePress = this.state.runItBackPressed ? this.state.frameCount - this.state.runItBackPressed : 999;
            const clickScale = framesSincePress < 10 ? 1 - (0.15 * (1 - framesSincePress / 10)) : 1;
            const clickAlpha = framesSincePress < 20 ? Math.max(0, 1 - (framesSincePress / 20)) : 1;
            
            // Pulse
            const pulse = Math.sin(this.state.frameCount * 0.06) * 0.5 + 0.5;
            const baseGlow = 20 + (pulse * 20);
            const hoverGlow = this.state.runItBackHover ? 20 : 0;
            const glowIntensity = baseGlow + hoverGlow;
            
            // Flowing shimmer position (for hover effect)
            const shimmerPos = (this.state.frameCount * 0.015) % 1;

            this.ctx.save();
            this.ctx.globalAlpha = btnProgress * clickAlpha;
            
            // Apply click compression
            const cx = btnX + btnW / 2;
            const cy = btnY + btnH / 2;
            this.ctx.translate(cx, cy);
            this.ctx.scale(clickScale, clickScale);
            this.ctx.translate(-cx, -cy);
            
            // Outer glow
            this.ctx.shadowBlur = glowIntensity;
            this.ctx.shadowColor = "#06b6d4";
            this.ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
            this.ctx.beginPath();
            this.ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
            this.ctx.fill();

            // Base gradient fill
            const gradient = this.ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
            gradient.addColorStop(0, "rgba(6, 182, 212, 0.9)");
            gradient.addColorStop(0.5, "rgba(59, 130, 246, 0.9)");
            gradient.addColorStop(1, "rgba(6, 182, 212, 0.9)");
            this.ctx.fillStyle = gradient;
            this.ctx.shadowBlur = 0;
            this.ctx.beginPath();
            this.ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
            this.ctx.fill();

            // Flowing shimmer overlay on hover
            if (this.state.runItBackHover && framesSincePress > 20) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
                this.ctx.clip();
                
                const shimmerW = 80;
                const shimmerX = btnX - shimmerW + (btnW + shimmerW * 2) * shimmerPos;
                const shimmerGrad = this.ctx.createLinearGradient(shimmerX, 0, shimmerX + shimmerW, 0);
                shimmerGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
                shimmerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
                shimmerGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
                this.ctx.fillStyle = shimmerGrad;
                this.ctx.fillRect(btnX, btnY, btnW, btnH);
                
                this.ctx.restore();
            }

            // Border (brighter on hover)
            this.ctx.strokeStyle = this.state.runItBackHover ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.4)";
            this.ctx.lineWidth = this.state.runItBackHover ? 3 : 2;
            this.ctx.beginPath();
            this.ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
            this.ctx.stroke();

            // Button text
            this.ctx.font = "900 26px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fff";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
            this.ctx.fillText("RUN IT BACK  →", btnX + btnW / 2, btnY + btnH / 2);
            this.ctx.restore();

            // Hint text
            this.ctx.save();
            this.ctx.globalAlpha = btnProgress * clickAlpha;
            this.ctx.font = "13px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "alphabetic";
            this.ctx.fillText(
                this.isMobile ? "tap anywhere" : "click button  •  space  •  enter", 
                this.canvas.width / 2, 
                btnYBase + btnH + 28
            ); 
            this.ctx.restore();
        }
    }
    _renderStartScreen() { 
        if (this.isMobile && this.overlay) this.overlay.classList.add('active'); 
        
        const f = this.state.frameCount;
        const breathe = Math.sin(f * 0.04) * 0.5 + 0.5;
        const slowPulse = Math.sin(f * 0.02) * 0.5 + 0.5;
        const heroBreathe = 1 + Math.sin(f * 0.03) * 0.02; // 0.98 - 1.02
        
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        
        // --- HERO: The ready message with breathing scale + shimmer ---
        this.ctx.save();
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        // Apply breathing scale
        this.ctx.translate(cx, cy - 60);
        this.ctx.scale(heroBreathe, heroBreathe);
        this.ctx.translate(-cx, -(cy - 60));
        
        // Dynamic font sizing
        let heroFontSize = 64;
        this.ctx.font = `900 ${heroFontSize}px 'Outfit', sans-serif`;
        let measuredW = this.ctx.measureText(this.state.currentReadyMsg).width;
        const maxW = this.canvas.width * 0.85;
        if (measuredW > maxW) {
            heroFontSize = Math.floor(heroFontSize * (maxW / measuredW));
            this.ctx.font = `900 ${heroFontSize}px 'Outfit', sans-serif`;
            measuredW = this.ctx.measureText(this.state.currentReadyMsg).width;
        }
        
        // Heavy stroke
        this.ctx.shadowBlur = 30 + (breathe * 20);
        this.ctx.shadowColor = "#a855f7";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 8;
        this.ctx.strokeText(this.state.currentReadyMsg, cx, cy - 60);
        
        // Gradient fill
        const heroGrad = this.ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
        heroGrad.addColorStop(0, "#06b6d4");
        heroGrad.addColorStop(0.5, "#a855f7");
        heroGrad.addColorStop(1, "#06b6d4");
        this.ctx.fillStyle = heroGrad;
        this.ctx.fillText(this.state.currentReadyMsg, cx, cy - 60);
        
        // Shimmer overlay — swept across the text
        const heroShimmerPos = (f * 0.006) % 1.5 - 0.25; // -0.25 to 1.25
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-atop';
        const shimmerGradHero = this.ctx.createLinearGradient(
            cx - measuredW/2 + measuredW * heroShimmerPos - 80, 0,
            cx - measuredW/2 + measuredW * heroShimmerPos + 80, 0
        );
        shimmerGradHero.addColorStop(0, "rgba(255, 255, 255, 0)");
        shimmerGradHero.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
        shimmerGradHero.addColorStop(1, "rgba(255, 255, 255, 0)");
        this.ctx.fillStyle = shimmerGradHero;
        this.ctx.fillText(this.state.currentReadyMsg, cx, cy - 60);
        this.ctx.restore();
        
        this.ctx.restore();
        
        // --- INSTRUCTION CARDS: bigger, bolder ---
        const instructions = this.isMobile 
            ? [
                { icon: "🪽", label: "FLAP", desc: "TAP SCREEN" },
                { icon: "💣", label: "BOMB", desc: "BOMB BUTTON" }
              ]
            : [
                { icon: "🪽", label: "FLAP", desc: "SPACE or CLICK" },
                { icon: "💥", label: "BOMB", desc: "SHIFT or R-CLICK" }
              ];
        
        const cardW = 290;
        const cardH = 170;
        const cardGap = 28;
        const totalW = (cardW * 2) + cardGap;
        const startX = cx - totalW / 2;
        const instY = cy + 20;
        
        instructions.forEach((ins, i) => {
            const iX = startX + (i * (cardW + cardGap));
            const accent = i === 0 ? "#06b6d4" : "#a855f7";
            const accentRgb = i === 0 ? "6, 182, 212" : "168, 85, 247";
            
            this.ctx.save();
            
            // Card tint
            this.ctx.fillStyle = `rgba(${accentRgb}, 0.12)`;
            this.ctx.beginPath();
            this.ctx.roundRect(iX, instY, cardW, cardH, 20);
            this.ctx.fill();
            
            // Dark backing
            this.ctx.fillStyle = "rgba(10, 10, 15, 0.55)";
            this.ctx.beginPath();
            this.ctx.roundRect(iX, instY, cardW, cardH, 20);
            this.ctx.fill();
            
            // Glowing border
            this.ctx.shadowBlur = 18 + (slowPulse * 10);
            this.ctx.shadowColor = accent;
            this.ctx.strokeStyle = accent;
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.roundRect(iX, instY, cardW, cardH, 20);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            // Icon (larger)
            this.ctx.font = "60px serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(ins.icon, iX + cardW / 2, instY + 55);
            
            // Label
            this.ctx.font = "900 32px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fff";
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = accent;
            this.ctx.fillText(ins.label, iX + cardW / 2, instY + 115);
            this.ctx.shadowBlur = 0;
            
            // Description
            this.ctx.font = "bold 14px 'Outfit', sans-serif";
            this.ctx.fillStyle = accent;
            this.ctx.fillText(ins.desc, iX + cardW / 2, instY + 145);
            
            this.ctx.restore();
        });
        
        // --- HIGH SCORE BADGES ---
        if (this.state.highScore > 0 || this.state.highDirectHits > 0) {
            const badges = [
                { label: "BEST REACH", val: this.state.highScore, color: "#fbbf24" },
                { label: "BEST IMPACT", val: this.state.highDirectHits, color: "#06b6d4" },
                { label: "BEST MISSES", val: this.state.highTotalMisses, color: "#f43f5e" }
            ];
            
            const badgeY = 200;
            const bW = 150;
            const bH = 54;
            const bGap = 14;
            const bTotal = (bW * 3) + (bGap * 2);
            const bStartX = cx - bTotal / 2;
            
            badges.forEach((b, i) => {
                const bX = bStartX + (i * (bW + bGap));
                
                this.ctx.save();
                this.ctx.globalAlpha = 0.9;
                
                this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
                this.ctx.beginPath();
                this.ctx.roundRect(bX, badgeY, bW, bH, 10);
                this.ctx.fill();
                
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = b.color;
                this.ctx.strokeStyle = b.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.roundRect(bX, badgeY, bW, bH, 10);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
                
                this.ctx.font = "bold 11px 'Outfit', sans-serif";
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "top";
                this.ctx.fillText(b.label, bX + bW / 2, badgeY + 8);
                
                this.ctx.font = "900 26px 'Outfit', sans-serif";
                this.ctx.fillStyle = b.color;
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(b.val, bX + bW / 2, badgeY + 36);
                
                this.ctx.restore();
            });
        }
        
        // --- PLAY BUTTON (formerly "PRESS ANY KEY TO BEGIN") ---
        const ctaText = this.isMobile ? "▶ TAP TO PLAY" : "▶ PRESS ENTER TO PLAY";
        
        this.ctx.save();
        this.ctx.font = "900 24px 'Outfit', sans-serif";
        const ctaW = this.ctx.measureText(ctaText).width + 60;
        const ctaH = 52;
        const ctaX = cx - ctaW / 2;
        const ctaBaseY = cy + 220;
        
        // Click compression for play button
        const playFramesSincePress = this.state.playBtnPressed ? f - this.state.playBtnPressed : 999;
        const playClickScale = playFramesSincePress < 15 ? 1 - (0.2 * (1 - playFramesSincePress / 15)) : 1;
        const playClickAlpha = playFramesSincePress < 30 ? Math.max(0, 1 - (playFramesSincePress / 30)) : 1;
        
        // Hover lift
        const playHoverLift = this.state.playBtnHover ? 4 : 0;
        // Focus state (keyboard selected)
        const playFocused = this.state.splashFocus === 0;
        const ctaY = ctaBaseY - playHoverLift;
        
        // Cache rect for hit-testing
        this._playBtnRect = { x: ctaX, y: ctaY - ctaH / 2, w: ctaW, h: ctaH };
        
        // Click compression transform
        const playBtnCx = ctaX + ctaW / 2;
        const playBtnCy = ctaY;
        this.ctx.translate(playBtnCx, playBtnCy);
        this.ctx.scale(playClickScale, playClickScale);
        this.ctx.translate(-playBtnCx, -playBtnCy);
        this.ctx.globalAlpha = playClickAlpha;
        
        // Backing panel
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
        this.ctx.beginPath();
        this.ctx.roundRect(ctaX, ctaY - ctaH / 2, ctaW, ctaH, 12);
        this.ctx.fill();
        
        // Pulsing border — brighter when focused/hovered
        const ctaPulse = Math.sin(f * 0.08) * 0.2 + 0.8;
        const ctaGlow = (playFocused || this.state.playBtnHover) ? 35 : 20;
        this.ctx.shadowBlur = ctaGlow;
        this.ctx.shadowColor = "#06b6d4";
        this.ctx.strokeStyle = "#06b6d4";
        this.ctx.lineWidth = (playFocused || this.state.playBtnHover) ? 3 : 2;
        this.ctx.globalAlpha = playClickAlpha * ctaPulse;
        this.ctx.beginPath();
        this.ctx.roundRect(ctaX, ctaY - ctaH / 2, ctaW, ctaH, 12);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Focus ring (extra outer stroke when keyboard-focused)
        if (playFocused) {
            this.ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(ctaX - 5, ctaY - ctaH / 2 - 5, ctaW + 10, ctaH + 10, 15);
            this.ctx.stroke();
        }
        
        // Shimmer on hover/focus
        if ((this.state.playBtnHover || playFocused) && playFramesSincePress > 30) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(ctaX, ctaY - ctaH / 2, ctaW, ctaH, 12);
            this.ctx.clip();
            const sPos = (f * 0.015) % 1;
            const sW = 60;
            const sX = ctaX - sW + (ctaW + sW * 2) * sPos;
            const sGrad = this.ctx.createLinearGradient(sX, 0, sX + sW, 0);
            sGrad.addColorStop(0, "rgba(6, 182, 212, 0)");
            sGrad.addColorStop(0.5, "rgba(6, 182, 212, 0.3)");
            sGrad.addColorStop(1, "rgba(6, 182, 212, 0)");
            this.ctx.fillStyle = sGrad;
            this.ctx.fillRect(ctaX, ctaY - ctaH / 2, ctaW, ctaH);
            this.ctx.restore();
        }
        
        // Text
        this.ctx.globalAlpha = playClickAlpha;
        this.ctx.fillStyle = "#06b6d4";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(ctaText, cx, ctaY);
        this.ctx.restore();
        
        // --- RENT-A-PIPE™ BUTTON ---
        const rentBtnW = 260;
        const rentBtnH = 58;
        const rentX = cx - rentBtnW / 2;
        const rentBaseY = ctaBaseY + 84;
        const rentPulse = Math.sin(f * 0.05) * 0.5 + 0.5;
        
        // Click compression for rent button
        const rentFramesSincePress = this.state.rentBtnPressed ? f - this.state.rentBtnPressed : 999;
        const rentClickScale = rentFramesSincePress < 15 ? 1 - (0.2 * (1 - rentFramesSincePress / 15)) : 1;
        const rentClickAlpha = rentFramesSincePress < 30 ? Math.max(0, 1 - (rentFramesSincePress / 30)) : 1;
        
        // Hover lift
        const rentHoverLift = this.state.rentBtnHover ? 4 : 0;
        const rentFocused = this.state.splashFocus === 1;
        const rentY = rentBaseY - rentHoverLift;
        
        this._rentBtnRect = { x: rentX, y: rentY, w: rentBtnW, h: rentBtnH };
        
        this.ctx.save();
        const rentBtnCx = rentX + rentBtnW / 2;
        const rentBtnCy = rentY + rentBtnH / 2;
        this.ctx.translate(rentBtnCx, rentBtnCy);
        this.ctx.scale(rentClickScale, rentClickScale);
        this.ctx.translate(-rentBtnCx, -rentBtnCy);
        this.ctx.globalAlpha = rentClickAlpha;
        
        // Outer glow (brighter when hovered/focused)
        const rentGlow = 15 + (rentPulse * 15) + ((this.state.rentBtnHover || rentFocused) ? 20 : 0);
        this.ctx.shadowBlur = rentGlow;
        this.ctx.shadowColor = "#f59e0b";
        this.ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
        this.ctx.beginPath();
        this.ctx.roundRect(rentX, rentY, rentBtnW, rentBtnH, 12);
        this.ctx.fill();
        
        // Gradient fill
        const rentGrad = this.ctx.createLinearGradient(rentX, rentY, rentX + rentBtnW, rentY);
        rentGrad.addColorStop(0, "rgba(245, 158, 11, 0.95)");
        rentGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.95)");
        rentGrad.addColorStop(1, "rgba(245, 158, 11, 0.95)");
        this.ctx.fillStyle = rentGrad;
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.roundRect(rentX, rentY, rentBtnW, rentBtnH, 12);
        this.ctx.fill();
        
        // Border (thicker when hovered/focused)
        this.ctx.strokeStyle = (this.state.rentBtnHover || rentFocused) ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.4)";
        this.ctx.lineWidth = (this.state.rentBtnHover || rentFocused) ? 3 : 2;
        this.ctx.beginPath();
        this.ctx.roundRect(rentX, rentY, rentBtnW, rentBtnH, 12);
        this.ctx.stroke();
        
        // Focus ring
        if (rentFocused) {
            this.ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(rentX - 5, rentY - 5, rentBtnW + 10, rentBtnH + 10, 15);
            this.ctx.stroke();
        }
        
        // Shimmer
        if ((this.state.rentBtnHover || rentFocused) && rentFramesSincePress > 30) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(rentX, rentY, rentBtnW, rentBtnH, 12);
            this.ctx.clip();
            const sPos = (f * 0.015) % 1;
            const sW = 70;
            const sX = rentX - sW + (rentBtnW + sW * 2) * sPos;
            const sGrad = this.ctx.createLinearGradient(sX, 0, sX + sW, 0);
            sGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
            sGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.4)");
            sGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
            this.ctx.fillStyle = sGrad;
            this.ctx.fillRect(rentX, rentY, rentBtnW, rentBtnH);
            this.ctx.restore();
        }
        
        // Text — "RENT-A-PIPE™" with tiny TM
        this.ctx.font = "900 20px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fff";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        
        // Main text baseline
        const mainText = "💰  RENT-A-PIPE";
        const priceText = "  $5";
        const tmText = "™";
        
        // Measure all parts
        const mainW = this.ctx.measureText(mainText).width;
        const priceW = this.ctx.measureText(priceText).width;
        this.ctx.font = "900 11px 'Outfit', sans-serif";
        const tmW = this.ctx.measureText(tmText).width;
        
        const totalTextW = mainW + tmW + priceW;
        const textStartX = rentBtnCx - totalTextW / 2;
        
        // Draw main
        this.ctx.font = "900 20px 'Outfit', sans-serif";
        this.ctx.textAlign = "left";
        this.ctx.fillText(mainText, textStartX, rentBtnCy);
        
        // Draw tiny TM superscript
        this.ctx.font = "900 11px 'Outfit', sans-serif";
        this.ctx.fillText(tmText, textStartX + mainW, rentBtnCy - 8);
        
        // Draw price
        this.ctx.font = "900 20px 'Outfit', sans-serif";
        this.ctx.fillText(priceText, textStartX + mainW + tmW, rentBtnCy);
        
        this.ctx.restore();
        
        // --- KEYBOARD HINT (subtle, below rent button) ---
        if (!this.isMobile) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.4;
            this.ctx.font = "11px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "alphabetic";
            this.ctx.fillText("← → arrow keys to select  •  enter to activate", cx, rentBaseY + rentBtnH + 22);
            this.ctx.restore();
        }
    }
    _resetToSplash() {
        this.state.isGameOver = false;
        this.state.score = 0;
        this.state.directHits = 0;
        this.state.totalMisses = 0;
        this.state.lastMissFrame = 0;
        this.state.runItBackHover = false;
        this.state.runItBackPressed = 0;
        this.state.playBtnHover = false;
        this.state.rentBtnHover = false;
        this.state.playBtnPressed = 0;
        this.state.rentBtnPressed = 0;
        this.state.splashFocus = 0;
        this.canvas.style.cursor = 'default';
        
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

    _triggerButtonExplosion() {
        this.state.runItBackPressed = this.state.frameCount;
        this.state.screenShake = 20;
        
        const btnW = 280;
        const btnH = 64;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2 + 180 + btnH / 2;
        
        // Explosive burst of neon particles in cyan/blue
        const burstColors = ["#06b6d4", "#3b82f6", "#22d3ee", "#fff"];
        for (let i = 0; i < 60; i++) {
            const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.2;
            const speed = Math.random() * 15 + 8;
            this.state.particles.push({
                x: cx + (Math.random() - 0.5) * btnW * 0.8,
                y: cy + (Math.random() - 0.5) * btnH,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 5 + 2,
                color: burstColors[Math.floor(Math.random() * burstColors.length)],
                life: 1.0,
                isMega: true
            });
        }
        
        // Play the shift sound for punch
        this.playSound('shift');
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
    _initMidground() {
        this.bubbles = [];
        
        // Layer A: Small bubbles (fastest, closest, most numerous)
        for (let i = 0; i < 15; i++) {
            this.bubbles.push({
                type: 'bubble',
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 4 + 1,         // 1 - 5px
                speed: Math.random() * 0.8 + 1.5,    // 1.5 - 2.3 (closest)
                alpha: Math.random() * 0.3 + 0.2,
                bobPhase: Math.random() * Math.PI * 2,
                bobSpeed: Math.random() * 0.02 + 0.01
            });
        }
        
        // Layer B: Medium drifting orbs (medium speed, glowy)
        for (let i = 0; i < 8; i++) {
            this.bubbles.push({
                type: 'orb',
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 8 + 4,          // 4 - 12px
                speed: Math.random() * 0.4 + 1.0,     // 1.0 - 1.4 (mid)
                alpha: Math.random() * 0.25 + 0.15,
                color: this.config.msgColors[Math.floor(Math.random() * this.config.msgColors.length)],
                bobPhase: Math.random() * Math.PI * 2,
                bobSpeed: Math.random() * 0.015 + 0.005
            });
        }
        
        // Layer C: Distant large dust motes (slowest of the mid layers, still faster than bg)
        for (let i = 0; i < 6; i++) {
            this.bubbles.push({
                type: 'dust',
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 18 + 10,        // 10 - 28px
                speed: Math.random() * 0.25 + 0.8,    // 0.8 - 1.05 (farthest of mid)
                alpha: Math.random() * 0.12 + 0.05,
                bobPhase: Math.random() * Math.PI * 2,
                bobSpeed: Math.random() * 0.01 + 0.003
            });
        }
    }
    _renderMidground() {
        this.bubbles.forEach(b => {
            const bobY = Math.sin(b.bobPhase) * 4;
            const drawY = b.y + bobY;
            
            this.ctx.save();
            this.ctx.globalAlpha = b.alpha;
            
            if (b.type === 'bubble') {
                // Small white bubbles
                this.ctx.fillStyle = "#fff";
                this.ctx.beginPath();
                this.ctx.arc(b.x, drawY, b.size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (b.type === 'orb') {
                // Glowy neon orbs
                this.ctx.shadowBlur = 12;
                this.ctx.shadowColor = b.color;
                this.ctx.fillStyle = b.color;
                this.ctx.beginPath();
                this.ctx.arc(b.x, drawY, b.size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (b.type === 'dust') {
                // Large soft dust motes (blurry, far away feel)
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                this.ctx.shadowBlur = b.size * 1.2;
                this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
                this.ctx.beginPath();
                this.ctx.arc(b.x, drawY, b.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        });
    }
}

