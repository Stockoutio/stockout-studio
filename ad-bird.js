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
            particleLifeDecay: 0.035,
            birdRotationFactor: 0.05,
            floatingTextRiseDelay: 30,
            floatingTextMaxAge: 73,

            _toneConfigs: {
                flap: { type: 'square', freq: [150, 400], vol: 0.5, dur: 0.1 },
                score: { type: 'sine', freq: [800, 1200], vol: 0.4, dur: 0.1 },
                crash: { type: 'sawtooth', freq: [100, 20], vol: 0.6, dur: 0.5 },
                shift: { type: 'square', freq: [200, 800], vol: 0.5, dur: 0.3 }
            },
            difficultyGainPerHit: 0.05,
            difficultyLossPerMiss: 0.04,
            difficultyMin: 0.85,
            difficultyMax: 2.5,
            minPipeSpawnGap: 55,
            slowMoDuration: 12,
            slowMoFactor: 0.25,
            comboVoiceLines: window.AdBirdContent.COMBO_VOICE_LINES,
            shopColors: [
                { id: 'default', name: 'DEFAULT', cost: 0, tint: null },
                { id: 'cyan', name: 'CYAN NEON', cost: 50, tint: '#06b6d4' },
                { id: 'magenta', name: 'HOT PINK', cost: 100, tint: '#ec4899' },
                { id: 'gold', name: 'GOLD RUSH', cost: 200, tint: '#fbbf24' },
                { id: 'purple', name: 'SYNERGY PURPLE', cost: 350, tint: '#a855f7' },
                { id: 'red', name: 'MARKET RED', cost: 500, tint: '#f43f5e' }
            ]
        };
        this.config = { ...this.config, ...options };
    }

    _getPressProgress(pressedTime) {
        if (!pressedTime) return 1;
        const elapsed = (Date.now() - pressedTime) / 1000;
        return Math.max(0, 1 - elapsed * 3);
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
            particles: [], deathMsg: "", currentReadyMsg: "",
            fullscreenHover: false, muteHover: false, fullscreenPressed: 0, mutePressed: 0,
            combo: 0, lastHitFrame: 0, missCombo: 0, difficultyMultiplier: 1.0, lastDifficultyChangeFrame: 0,
            slowMoTimer: 0, slowMoStrength: 0,
            comboVoiceBag: [],
            adCoins: parseInt(this._safeStorage('get', 'adBirdCoins')) || 0,
            ownedColors: JSON.parse(this._safeStorage('get', 'adBirdOwnedColors') || '["default"]'),
            selectedColor: this._safeStorage('get', 'adBirdSelectedColor') || 'default',
            shopOpen: false,
            shopHoverIndex: -1,
            lastCoinsEarned: 0
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

    // NEW: URL Obfuscation
    _getStripeUrl() {
        return atob('aHR0cHM6Ly9idXkuc3RyaXBlLmNvbS85QjZhRVgwamRnT1Y4aXE3c0RjYkMwMA==');
    }

    _initEngine() {
        // NEW:
        this.lastTime = 0;
        this._boundLoop = (timestamp = 0) => this._loop(timestamp);
        
        // NEW: Store bound functions for reliable removal in destroy()
        this._handleKeydown = this._handleKeydown.bind(this);
        this._handleInput = this._handleInput.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleResize = this._handleResize.bind(this);
        this._handleTouchStart = this._handleTouchStart.bind(this);

        this.assets.player.src = this.config.playerImg;
        this.assets.player.onload = () => this.state.assetsLoaded++;
        // NEW:
        this.assets.player.onerror = () => { console.warn("Player image failed to load"); this.state.assetsLoaded++; };
        this.config.worlds.forEach((p) => { 
            const img = new Image(); 
            img.src = p; 
            img.onload = () => { this.state.assetsLoaded++; }; 
            // NEW:
            img.onerror = () => { console.warn(`World image ${p} failed to load`); this.state.assetsLoaded++; };
            this.assets.worlds.push(img); 
        });
        
        window.addEventListener('keydown', this._handleKeydown);
        window.addEventListener('resize', this._handleResize);
        window.addEventListener('orientationchange', this._handleResize);
        
        const it = this.canvas.parentElement || this.canvas;
        it.addEventListener('mousedown', this._handleInput);
        it.addEventListener('mousemove', this._handleMouseMove);
        it.addEventListener('touchstart', this._handleTouchStart, { passive: false });
        
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
        
        // Fullscreen toggle always works — even during death pause
        if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            this.toggleFullscreen();
            return;
        }

        // Block all other input during the death animation pause
        // (prevents space/enter from triggering splash logic mid-death)
        if (this.state.waitingForGameOver) {
            e.preventDefault();
            return;
        }

        const isFlap = KEYMAP.flapCodes.includes(e.code) || KEYMAP.flapKeys.includes(e.key);
        const isBomb = KEYMAP.bombCodes.includes(e.code) || KEYMAP.bombKeys.includes(e.key);
        const isEnter = e.code === 'Enter' || e.key === 'Enter';
        
        // Focus navigation keys
        const isFocusCycle = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code) || 
                            ['a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(e.key);

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
            // Any direction/WASD cycles focus
            if (isFocusCycle) {
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
                        window.open(this._getStripeUrl(), '_blank');
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

    _handleTouchStart(e) {
        if (this.isMobile) { 
            e.preventDefault(); 
            for (let i = 0; i < e.changedTouches.length; i++) { 
                const t = e.changedTouches[i]; 
                this._handleInput({ clientX: t.clientX, clientY: t.clientY, button: 0, preventDefault: () => {} }); 
            } 
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
        
        // Fullscreen and mute are exclusive — they always do their own thing, never advance
        if (action === 'fullscreen') { 
            this.state.fullscreenPressed = Date.now();
            this.toggleFullscreen(); 
            return; 
        }
        if (action === 'mute') { 
            this.state.mutePressed = Date.now();
            this.toggleMute(); 
            return; 
        }

        if (this.state.waitingForGameOver) return;
        
        // Game over — shop takes priority, then tap anywhere advances
        if (this.state.isGameOver) {
            // If shop is open, let it handle the click (purchase, select, or close)
            if (this.state.shopOpen) {
                if (this._handleShopClick(x, y)) return;
            }

            // Shop button opens the modal (over the game over screen)
            if (this._gameOverShopBtnRect &&
                x >= this._gameOverShopBtnRect.x && x <= this._gameOverShopBtnRect.x + this._gameOverShopBtnRect.w &&
                y >= this._gameOverShopBtnRect.y && y <= this._gameOverShopBtnRect.y + this._gameOverShopBtnRect.h) {
                this.state.shopOpen = !this.state.shopOpen;
                this.playSound('score');
                return;
            }

            // Don't advance to splash while shop is open
            if (this.state.shopOpen) return;

            this._triggerButtonExplosion();
            this._resetToSplash();
            return;
        }
        
        // Splash screen
        if (!this.state.gameRunning) { 
            if (this.state.shopOpen) {
                if (this._handleShopClick(x, y)) return;
            }

            if (this._shopBtnRect && x >= this._shopBtnRect.x && x <= this._shopBtnRect.x + this._shopBtnRect.w &&
                y >= this._shopBtnRect.y && y <= this._shopBtnRect.y + this._shopBtnRect.h) {
                this.state.shopOpen = !this.state.shopOpen;
                this.playSound('score');
                return;
            }

            if (this.state.shopOpen) return;

            // RENT button is the ONLY exclusive button on splash — tap advances, rent opens Stripe
            if (this._isOverRentBtn(x, y)) {
                this._triggerSplashButtonExplosion('rent');
                setTimeout(() => {
                    window.open(this._getStripeUrl(), '_blank');
                }, 300);
                return;
            }
            // Tap anywhere else — always animates the PLAY button (not at tap location)
            this._triggerSplashButtonExplosion('play');
            setTimeout(() => this.start(), 300);
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
        const action = this._hitTest(x, y);
        const hoveringFS = action === 'fullscreen';
        const hoveringMute = action === 'mute';

        this.state.runItBackHover = hoveringRunBack;
        this.state.playBtnHover = hoveringPlay;
        this.state.rentBtnHover = hoveringRent;
        this.state.fullscreenHover = hoveringFS;
        this.state.muteHover = hoveringMute;

        // If hovering a splash button, shift focus to it
        if (hoveringPlay) this.state.splashFocus = 0;
        else if (hoveringRent) this.state.splashFocus = 1;

        this.canvas.style.cursor = (hoveringRunBack || hoveringPlay || hoveringRent || hoveringFS || hoveringMute) ? 'pointer' : 'default';
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

    _triggerSplashButtonExplosion(type) {
        if (type === 'play') {
            this.state.playBtnPressed = Date.now();
            this.state.screenShake = 25;
            this.playSound('score');
        } else if (type === 'rent') {
            this.state.rentBtnPressed = Date.now();
            this.state.screenShake = 15;
            this.playSound('score');
        }
        const rect = type === 'play' ? this._playBtnRect : this._rentBtnRect;
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        
        const burstColors = type === 'play' 
            ? ["#06b6d4", "#3b82f6", "#22d3ee", "#fff", "#a855f7"]
            : ["#f59e0b", "#ec4899", "#fbbf24", "#fff", "#f43f5e"];
        
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
        Object.assign(this.state, { gameRunning: true, isGameOver: false, waitingForGameOver: false, score: 0, directHits: 0, totalMisses: 0, lastMissFrame: 0, frameCount: 0, nextPipeFrame: 40, bgX: 0, screenShake: 0, bombTimer: 0, paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], readyMsgBag: [], missMsgBag: [], megaMissMsgBag: [], worldBag: [], stockInARow: 0, particles: [], gameOverFrame: 0, runItBackHover: false, runItBackPressed: 0, playBtnHover: false, rentBtnHover: false, playBtnPressed: 0, rentBtnPressed: 0, combo: 0, lastHitFrame: 0, missCombo: 0, difficultyMultiplier: 1.0, comboVoiceBag: [] });
        this.canvas.style.cursor = 'default';
        Object.assign(this.player, { y: 150, velocity: 0, flipAngle: 0, isFlipping: false });
        this.pipes = []; this.bombs = []; this.floatingTexts = [];
        if (this.assets.music && !this.state.isMuted) { this.assets.music.currentTime = 0; this.assets.music.play().catch(() => {}); }
    }

    // NEW:
    _loop(timestamp = 0) {
        const dt = Math.min((timestamp - (this.lastTime || timestamp)) / 16.67, 2.5);
        this.lastTime = timestamp;
        this._update(dt);
        this._updateParticles(dt);
        this._draw();
        requestAnimationFrame(this._boundLoop);
    }

    // NEW:
    _update(dt) {
        // Decays run regardless of game state so the game over screen doesn't shake forever
        if (this.state.screenShake > 0) this.state.screenShake *= 0.9;
        if (this.state.flashOpacity > 0) this.state.flashOpacity *= 0.92;

        if (!this.state.gameRunning || this.state.isGameOver) {
            this.state.frameCount += dt;
            return;
        }

        let effectiveDt = dt;
        if (this.state.slowMoTimer > 0) {
            const slowRatio = this.state.slowMoTimer / this.config.slowMoDuration;
            const factor = this.state.slowMoStrength + (1 - this.state.slowMoStrength) * (1 - slowRatio);
            effectiveDt = dt * factor;
            this.state.slowMoTimer -= dt;
        }

        this.state.frameCount += dt;

        this.player.velocity += this.config.gravity * effectiveDt;
        this.player.y += this.player.velocity * effectiveDt;

        if (this.player.isFlipping) {
            this.player.flipAngle += (this.player.flipDirection * this.player.flipSpeed) * (effectiveDt / dt);
            if (Math.abs(this.player.flipAngle) >= Math.PI * 2) {
                this.player.flipAngle = 0;
                this.player.isFlipping = false;
            }
        }

        if (this.player.y < 0 || this.player.y + this.player.h > this.canvas.height) {
            this.gameOver();
        }

        this.state.bgX = (this.state.bgX - this.config.bgSpeed * effectiveDt) % this.canvas.width;
        if (this.state.bombTimer > 0) this.state.bombTimer -= effectiveDt;

        this._updateEntities(effectiveDt);
        if (this._updateFloatingTexts) this._updateFloatingTexts(effectiveDt);

        if (this.state.frameCount >= this.state.nextPipeFrame) {
            this._spawnPipe();
        }
    }

    // NEW:
    _updateParticles(dt) {
        for (let i = this.state.particles.length - 1; i >= 0; i--) { 
            const p = this.state.particles[i]; p.x += p.vx; p.y += p.vy; 
            if (p.rotation !== undefined) p.rotation += p.rotSpeed;
            // NEW:
            p.vy += this.config.particleGravity * dt * (p.isBit || p.isTurkey ? 1.5 : 1); 
            p.life -= (p.isDeath ? 0.005 : this.config.particleLifeDecay) * dt; // Death particles last longer
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

    // NEW:
    _updateEntities(dt) {
        const scoreRamp = Math.floor(this.state.score / 10) * 0.25;
        const dynamicSpeed = (this.config.pipeSpeed + scoreRamp) * this.state.difficultyMultiplier;

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            
            if (p.shakeTimer > 0) p.shakeTimer -= dt;
            if (p.collapsing && p.shakeTimer <= 0) {
                p.collapseVel += 0.8 * dt;
                p.collapseOffsetY += p.collapseVel * dt;
            }

            // Sparkle particles around active super pipes
            if (p.isSuper && !p.collapsing && Math.floor(this.state.frameCount) % 2 === 0) {
                this.state.particles.push({
                    x: p.x + p.w / 2 + (Math.random() - 0.5) * p.w,
                    y: Math.random() > 0.5 ? p.y - 5 : p.y + p.gap + 5,
                    vx: (Math.random() - 0.5) * 1,
                    vy: (Math.random() - 0.5) * 1,
                    size: Math.random() * 2 + 1,
                    color: Math.random() > 0.5 ? "#fbbf24" : "#fff",
                    life: 0.6,
                    isMega: true
                });
            }

            p.x -= dynamicSpeed * dt;
            if (p.highlight > 0) p.highlight *= 0.82;
            p.stains.forEach(s => s.drips.forEach(d => { if (d.len < d.maxLen) d.len += d.speed; }));
            
            const pd = 15; const bx = this.player.x+pd, bw = this.player.w-(pd*2), by = this.player.y+pd, bh = this.player.h-(pd*2);
            
            // NEAR-MISS DETECTION — skip for collapsing pipes (they're not a threat anymore)
            if (!p.collapsing && !p.nearMissed && bx < p.x + p.w && bx + bw > p.x) {
                const topGapEdge = p.y;
                const bottomGapEdge = p.y + p.gap;
                const distToTop = by - topGapEdge;
                const distToBottom = bottomGapEdge - (by + bh);
                const closestEdge = Math.min(distToTop, distToBottom);
                if (closestEdge > 0 && closestEdge < 25) {
                    p.nearMissed = true;
                    const fxY = distToTop < distToBottom ? topGapEdge : bottomGapEdge;
                    for (let k = 0; k < 10; k++) {
                        this.state.particles.push({
                            x: p.x + p.w / 2 + (Math.random() - 0.5) * p.w,
                            y: fxY + (Math.random() - 0.5) * 20,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4,
                            size: Math.random() * 3 + 1,
                            color: "#22d3ee",
                            life: 0.8,
                            isMega: true
                        });
                    }
                    const nearMissMsgs = ["NICE!", "THREADED IT", "TOO CLOSE", "DAMN", "CLUTCH"];
                    this.floatingTexts.push({
                        x: this.player.x + this.player.w / 2,
                        y: this.player.y - 20,
                        text: nearMissMsgs[Math.floor(Math.random() * nearMissMsgs.length)],
                        color: "#22d3ee",
                        scale: 0.9,
                        glow: "#06b6d4",
                        age: 0,
                        alpha: 1,
                        vy: -2,
                        vx: 0,
                        align: "center"
                    });
                    this._playTone({ type: 'sine', freq: [600, 900], vol: 0.2, dur: 0.08 });
                }
            }

            // Death collision — skip for collapsing pipes so bombed pipes never kill the player
            if (!p.collapsing && bx < p.x+p.w && bx+bw > p.x && (by < p.y || by+bh > p.y+p.gap)) { this.gameOver(); return; }
            if (!p.scored && p.x + p.w < this.player.x) { 
                p.scored = true; p.highlight = 1.0;
                if (p.isSuper) {
                    this._triggerSuperPipePass();
                } else {
                    this.state.score++; this.playSound('score'); 
                    if (this.state.score % this.config.worldShiftInterval === 0) this._shiftWorld(); 
                }
            }
            if (p.x + p.w < -150 || p.collapseOffsetY > this.canvas.height + 200) this.pipes.splice(i, 1);
        }
        for (let i = this.bombs.length - 1; i >= 0; i--) { 
            const b = this.bombs[i]; b.y += b.speed * dt; let hit = false; 
            for (const p of this.pipes) { 
                if (b.x > p.x && b.x < p.x + p.w && (b.y < p.y || b.y > p.y + p.gap)) { 
                    this._createSplat(p, b.x, b.y, b.scale); 
                    hit = true; break; 
                } 
            } 
            if (hit) {
                this.state.directHits++;
                this.bombs.splice(i, 1);
            }
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
                this.state.combo = 0;
                this.state.missCombo++;
                this.state.difficultyMultiplier = 1.0;
                this.playSound(isGiga ? 'mega_miss' : 'miss');
                this.bombs.splice(i, 1);
            }
        }
        this.bubbles.forEach(b => { 
            // NEW:
            b.x -= b.speed * dt; 
            b.bobPhase += b.bobSpeed;
            if (b.x < -20) { 
                b.x = this.canvas.width + 20; 
                b.y = Math.random() * this.canvas.height;  // Rerandomize y on respawn
            } 
        });
    }

    _spawnPipe() {
        const baseInterval = Math.floor(Math.random() * 80) + 80;
        const scaledInterval = Math.max(this.config.minPipeSpawnGap, baseInterval / this.state.difficultyMultiplier);
        this.state.nextPipeFrame = this.state.frameCount + scaledInterval;
        
        const gap = Math.random() * (this.config.maxGap - this.config.minGap) + this.config.minGap;
        const minH_top = this.config.minPipeHeightTop;
        const maxH_top = this.canvas.height - gap - this.config.minPipeHeightBottom;
        const h = Math.floor(Math.random() * (maxH_top - minH_top)) + minH_top;
        
        // Super pipe — rare (4%), only after the player has scored 10
        // Use a custom ad object so we don't burn through the normal ad bag
        const isSuper = this.state.score >= 10 && Math.random() < 0.04;
        const ad = isSuper ? { text: "JACKPOT", color: "#fbbf24" } : this._nextAd();
        
        this.pipes.push({ 
            x: this.canvas.width, y: h, w: this.config.pipeWidth, gap: gap, ad: ad, 
            scored: false, highlight: 0, stains: [],
            shakeTimer: 0, collapsing: false, collapseOffsetY: 0, collapseVel: 0,
            nearMissed: false,
            isSuper: isSuper
        });
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
            const shakeX = p.shakeTimer > 0 ? (Math.random() - 0.5) * 12 : 0;
            const shakeY = p.shakeTimer > 0 ? (Math.random() - 0.5) * 12 : 0;
            const collapseY = p.collapseOffsetY || 0;

            if (!p.collapsing) {
                // Fast path — render pipe as a single unit
                this.ctx.save();
                this.ctx.translate(shakeX, shakeY);
                this._drawPipeBody(p);
                this._drawPipeBorders(p, p.ad.color, 3);
                this._drawPipeCaps(p, p.ad.color, 3, 18);
                this._drawPipeStains(p, 3);
                this._drawPipeLabel(p, p.ad.color);
                this.ctx.restore();
                return;
            }

            // Collapsing pipe — render top and bottom halves separately
            // so only the bottom falls while the top stays rooted to the ceiling

            // TOP HALF — stays in place, fades out as bottom clears the screen
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, 1 - collapseY / 400);
            this.ctx.translate(shakeX, shakeY);
            this.ctx.beginPath();
            this.ctx.rect(p.x - 30, 0, p.w + 60, p.y + 25);
            this.ctx.clip();
            this._drawPipeBody(p);
            this._drawPipeBorders(p, p.ad.color, 3);
            this._drawPipeCaps(p, p.ad.color, 3, 18);
            this._drawPipeStains(p, 3);
            this.ctx.restore();

            // BOTTOM HALF — shake + collapse offset, carries the label down with it
            this.ctx.save();
            this.ctx.translate(shakeX, shakeY + collapseY);
            this.ctx.beginPath();
            this.ctx.rect(p.x - 30, p.y + p.gap - 25, p.w + 60, this.canvas.height - (p.y + p.gap) + 60);
            this.ctx.clip();
            this._drawPipeBody(p);
            this._drawPipeBorders(p, p.ad.color, 3);
            this._drawPipeCaps(p, p.ad.color, 3, 18);
            this._drawPipeStains(p, 3);
            this._drawPipeLabel(p, p.ad.color);
            this.ctx.restore();
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

        // COMBO INDICATOR — animated, scales and colors with combo tier
        if (this.state.combo >= 2) {
            const c = this.state.combo;
            const framesSincePunch = this.state.frameCount - this.state.lastHitFrame;
            const punch = Math.max(0, 1 - framesSincePunch / 10) * 0.5;       // 0 to 0.5, decays over 10 frames
            const breathe = Math.sin(this.state.frameCount * 0.15) * 0.04;     // gentle pulse
            const growth = Math.min(c / 20, 1) * 0.8;                          // 0 to 0.8, maxes at combo 20
            const scale = 1.0 + punch + breathe + growth;
            
            // Color tiers — cyan → yellow → orange → red → pink
            let color, glow;
            if (c >= 20)      { color = "#fff";     glow = "#ec4899"; }
            else if (c >= 15) { color = "#fecaca";  glow = "#ef4444"; }
            else if (c >= 10) { color = "#fed7aa";  glow = "#f97316"; }
            else if (c >= 5)  { color = "#fef3c7";  glow = "#fbbf24"; }
            else              { color = "#a5f3fc";  glow = "#06b6d4"; }
            
            // Shake ramps in from combo 9 onwards, caps at 10px
            const shakeAmount = Math.max(0, Math.min(c - 8, 10));
            const shakeX = (Math.random() - 0.5) * shakeAmount;
            const shakeY = (Math.random() - 0.5) * shakeAmount;
            
            // Rotation wobble kicks in at combo 15
            const wobble = c >= 15 ? Math.sin(this.state.frameCount * 0.4) * 0.08 : 0;
            
            this.ctx.save();
            this.ctx.translate(this.ui.scoreCenter + shakeX, 130 + shakeY);
            this.ctx.rotate(wobble);
            this.ctx.scale(scale, scale);
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.font = "900 26px 'Outfit', sans-serif";
            this.ctx.shadowBlur = 15 + punch * 30;
            this.ctx.shadowColor = glow;
            this.ctx.strokeStyle = "#000";
            this.ctx.lineWidth = 3;
            const text = `${c}× COMBO`;
            this.ctx.strokeText(text, 0, 0);
            this.ctx.fillStyle = color;
            this.ctx.fillText(text, 0, 0);
            this.ctx.restore();
        }

        // MISS COMBO
        if (this.state.missCombo >= 2) {
            const missText = `${this.state.missCombo}× MISSED 💸`;
            this.ctx.save();
            this.ctx.textAlign = "center";
            this.ctx.font = "900 20px 'Outfit', sans-serif";
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = "#f43f5e";
            this.ctx.fillStyle = "#fca5a5";
            this.ctx.fillText(missText, this.ui.scoreCenter, 170);
            this.ctx.restore();
        }

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

        // DIFFICULTY INDICATOR
        const diffX = padding + 180;
        this.ctx.font = "bold 14px 'Outfit', sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.fillText("SPEED", diffX, padding);
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.fillText(this.state.difficultyMultiplier.toFixed(2) + "x", diffX, padding + 20);
        
        this.ctx.restore();
        
        // Mute button — circular, top right
        const m = this.ui.muteBtn;
        this.ctx.save();
        const mHoverScale = this.state.muteHover ? 1.1 : 1.0;
        const mPressProgress = this._getPressProgress(this.state.mutePressed);
        const mPressScale = 0.85 + mPressProgress * 0.15;
        const mFinalScale = mHoverScale * mPressScale;
        
        this.ctx.translate(m.x, m.y);
        this.ctx.scale(mFinalScale, mFinalScale);
        
        if (this.state.muteHover) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = "#fff";
        }
        
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)";
        this.ctx.beginPath();
        this.ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.font = "22px serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", 0, 1);
        this.ctx.restore();

        // Fullscreen button — circular, top right
        const fs = this.ui.fullscreenBtn;
        this.ctx.save();
        const fsHoverScale = this.state.fullscreenHover ? 1.1 : 1.0;
        const fsPressProgress = this._getPressProgress(this.state.fullscreenPressed);
        const fsPressScale = 0.85 + fsPressProgress * 0.15;
        const fsFinalScale = fsHoverScale * fsPressScale;
        
        this.ctx.translate(fs.x, fs.y);
        this.ctx.scale(fsFinalScale, fsFinalScale);
        
        if (this.state.fullscreenHover) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = "#fff";
        }
        
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)";
        this.ctx.beginPath();
        this.ctx.arc(0, 0, fs.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.font = "bold 28px serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillText("⤢", 0, 2);
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
        
        if (isMega) {
            // The bombed pipe always collapses
            p.shakeTimer = 18;
            p.collapsing = true;
            this.state.slowMoTimer = this.config.slowMoDuration;
            this.state.slowMoStrength = this.config.slowMoFactor;
            
            // CHAIN REACTION — only triggers when player has built up a 10+ combo
            // Feels like a screen-clear reward for high streaks, not a constant chaos generator
            if (this.state.combo >= 10) {
                const shockwaveRadius = 400;
                let chainedCount = 0;
                this.pipes.forEach(otherPipe => {
                    if (otherPipe === p) return;
                    const dist = Math.abs(otherPipe.x - p.x);
                    if (dist < shockwaveRadius) {
                        otherPipe.shakeTimer = 18;
                        otherPipe.collapsing = true;
                        chainedCount++;
                    }
                });
                if (chainedCount > 0) {
                    this.floatingTexts.push({
                        x: this.canvas.width / 2,
                        y: this.canvas.height / 2 + 60,
                        text: "CHAIN REACTION!",
                        color: "#fbbf24",
                        scale: 1.6,
                        glow: "#f59e0b",
                        age: 0,
                        alpha: 1,
                        vy: -3,
                        vx: 0,
                        align: "center",
                        isMega: true,
                        isShivering: true
                    });
                    this.state.screenShake = Math.max(this.state.screenShake, 35);
                    this.state.flashOpacity = 0.8;
                }
            }
        }

        this.state.screenShake = isMega ? 30 : 10 * scale; 
        if (isMega) this.state.flashOpacity = 0.6;
        
        // Combo persists indefinitely between hits — only a miss breaks it
        this.state.combo++;
        this.state.missCombo = 0;
        this.state.difficultyMultiplier = Math.min(this.config.difficultyMax, this.state.difficultyMultiplier + this.config.difficultyGainPerHit);
        this.state.lastHitFrame = this.state.frameCount;

        this.player.isFlipping = true; this.player.flipAngle = 0; 
        
        const pCount = isMega ? 90 : 30;
        for (let i = 0; i < pCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = isMega ? Math.random() * 22 + 8 : Math.random() * 12 + 4;
            this.state.particles.push({
                x: bx,
                y: by,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                color: p.ad.color,
                life: 1.0 + (isMega ? Math.random() : 0),
                size: isMega ? Math.random() * 7 + 3 : Math.random() * 4 + 2,
                isMega: isMega
            });
        }

        // ADD a second ring of white sparks for extra pop
        const sparkCount = isMega ? 30 : 10;
        for (let i = 0; i < sparkCount; i++) {
            const angle = (Math.PI * 2 * i) / sparkCount;
            const speed = isMega ? 14 : 7;
            this.state.particles.push({
                x: bx,
                y: by,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: "#fff",
                life: 0.6,
                size: isMega ? 4 : 2,
                isMega: true
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

        // Floating combo text removed — combo indicator now lives in the HUD

        if (this.state.combo > 0 && this.state.combo % 5 === 0) {
            // Fallback if comboVoiceLines failed to load from content.js
            if (!this.config.comboVoiceLines || this.config.comboVoiceLines.length === 0) {
                this.config.comboVoiceLines = [
                    "BRAND SUPREMACY",
                    "KPIs ANNIHILATED",
                    "SYNERGY ACHIEVED",
                    "MARKET PENETRATION MAXIMUM",
                    "VIRAL TRAJECTORY CONFIRMED"
                ];
            }
            const voiceLine = this._nextFromBag('comboVoiceBag', 'comboVoiceLines');
            if (voiceLine) {
                this.floatingTexts.push({
                    x: this.canvas.width / 2,
                    y: this.canvas.height / 2 - 40,
                    text: voiceLine,
                    color: "#fff",
                    scale: 1.8,
                    glow: "#a855f7",
                    age: 0,
                    alpha: 1,
                    vy: -2,
                    vx: 0,
                    align: "center",
                    isMega: true,
                    isShivering: true
                });
                this.state.screenShake = Math.max(this.state.screenShake, 15);
                this.playSound('shift');
            }
        }
    }

    _triggerSuperPipePass() {
        this.state.score += 5;
        this.state.directHits += 3;
        this.state.screenShake = 30;
        this.state.flashOpacity = 1.0;
        this.state.slowMoTimer = this.config.slowMoDuration;
        this.state.slowMoStrength = 0.35;
        
        // Golden explosion from the bird
        const cx = this.player.x + this.player.w / 2;
        const cy = this.player.y + this.player.h / 2;
        const colors = ["#fbbf24", "#fff", "#f59e0b", "#fde047"];
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 20 + 5;
            this.state.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 5 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0 + Math.random(),
                isMega: true
            });
        }
        
        // Fanfare floating text
        this.floatingTexts.push({
            x: this.canvas.width / 2,
            y: this.canvas.height / 2 - 20,
            text: "JACKPOT! +5",
            color: "#fff",
            scale: 2.2,
            glow: "#fbbf24",
            age: 0, alpha: 1,
            vy: -3, vx: 0,
            align: "center",
            isMega: true,
            isShivering: true
        });
        
        this.playSound('shift');
        if (this.state.score % this.config.worldShiftInterval === 0) this._shiftWorld();
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

            const earned = Math.floor(this.state.score / 5) + (this.state.directHits * 2);
            this.state.adCoins += earned;
            this._safeStorage('set', 'adBirdCoins', this.state.adCoins);
            this.state.lastCoinsEarned = earned;

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
    _renderBombs() {
        this.bombs.forEach(b => {
            // Trail — longer, denser, color-shifted
            this.ctx.save();
            for (let i = 1; i < 10; i++) {
                const alpha = (1 - i / 10) * 0.75;
                this.ctx.globalAlpha = alpha;
                const trailColor = i < 4 ? "#fbbf24" : i < 7 ? "#f59e0b" : "#ec4899";
                this.ctx.fillStyle = trailColor;
                this.ctx.shadowBlur = 12;
                this.ctx.shadowColor = trailColor;
                const trailSize = Math.max(1, (b.w / 2) * (1 - i / 10));
                this.ctx.beginPath();
                this.ctx.arc(b.x + (Math.random() - 0.5) * 2, b.y - (i * 10), trailSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();

            // Main bomb
            this.ctx.save();
            this.ctx.fillStyle = "#fff";
            this.ctx.shadowBlur = 25;
            this.ctx.shadowColor = "#ec4899";
            this.ctx.beginPath();
            this.ctx.ellipse(b.x, b.y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Giga bomb extra glow
            if (b.scale >= 5.0) {
                this.ctx.shadowBlur = 40;
                this.ctx.shadowColor = "#f43f5e";
                this.ctx.globalAlpha = 0.4 + Math.sin(this.state.frameCount * 0.3) * 0.2;
                this.ctx.fillStyle = "#f43f5e";
                this.ctx.beginPath();
                this.ctx.ellipse(b.x, b.y, b.w / 2 + 6, b.h / 2 + 6, 0, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        });
    }
    _renderPlayer() {
        if (this.state.isGameOver) return;

        const combo = this.state.combo;
        const cx = this.player.x + this.player.w / 2;
        const cy = this.player.y + this.player.h / 2;

        // Render combo aura BEHIND player
        if (combo >= 3) {
            const comboT = Math.min(1, (combo - 3) / 10);  // ramps 0 to 1 over combo 3-13
            const pulse = Math.sin(this.state.frameCount * 0.2) * 0.15 + 0.85;
            
            // Color interpolates yellow -> orange -> red
            let auraColor;
            if (comboT < 0.5) {
                // yellow to orange
                const t = comboT * 2;
                auraColor = `rgb(${255}, ${Math.floor(200 - t * 80)}, ${Math.floor(50 - t * 50)})`;
            } else {
                // orange to red
                const t = (comboT - 0.5) * 2;
                auraColor = `rgb(${255}, ${Math.floor(120 - t * 80)}, ${Math.floor(20 - t * 20)})`;
            }

            const auraRadius = (this.player.w / 2) * (1.3 + comboT * 0.5) * pulse;
            
            this.ctx.save();
            this.ctx.globalAlpha = 0.35 + comboT * 0.3;
            this.ctx.shadowBlur = 25 + comboT * 35;
            this.ctx.shadowColor = auraColor;
            this.ctx.fillStyle = auraColor;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner brighter core
            this.ctx.globalAlpha = 0.15 + comboT * 0.2;
            this.ctx.fillStyle = "#fff";
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = auraColor;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, auraRadius * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            // Spawn occasional ember particles at high combo
            if (combo >= 6 && this.state.frameCount % 4 === 0) {
                this.state.particles.push({
                    x: cx + (Math.random() - 0.5) * this.player.w,
                    y: cy + (Math.random() - 0.5) * this.player.h,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: -Math.random() * 2 - 1,
                    size: Math.random() * 3 + 1,
                    color: auraColor,
                    life: 0.6,
                    isMega: true
                });
            }
        }

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.player.velocity * this.config.birdRotationFactor)) + this.player.flipAngle);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.assets.player, -this.player.w / 2, -this.player.h / 2, this.player.w, this.player.h);

        const selected = this.config.shopColors.find(c => c.id === this.state.selectedColor);
        if (selected && selected.tint) {
            // Step 1 — multiply blend tints the whole rect with the color, preserving the bird's
            // shading and outlines (black stays black, white becomes the tint, greys become tinted greys)
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillStyle = selected.tint;
            this.ctx.fillRect(-this.player.w / 2, -this.player.h / 2, this.player.w, this.player.h);
            
            // Step 2 — the multiply leaked outside the bird's silhouette into transparent areas.
            // destination-in with the original sprite clips the result back to the bird's shape.
            this.ctx.globalCompositeOperation = 'destination-in';
            this.ctx.drawImage(this.assets.player, -this.player.w / 2, -this.player.h / 2, this.player.w, this.player.h);
        }
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

        const coinT = Math.max(0, t - 55);
        const coinProgress = ease(coinT, 20);
        if (coinProgress > 0 && this.state.lastCoinsEarned > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = coinProgress;
            this.ctx.font = "bold 22px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fbbf24";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = "#fbbf24";
            this.ctx.fillText(`+${this.state.lastCoinsEarned} AD COINS 🪙   (TOTAL: ${this.state.adCoins})`, this.canvas.width / 2, this.canvas.height / 2 + 150);
            this.ctx.restore();
        }

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

            // SHOP BUTTON — below hint text
            const shopBtnW = 180;
            const shopBtnH = 40;
            const shopBtnX = (this.canvas.width - shopBtnW) / 2;
            const shopBtnY = btnYBase + btnH + 50;
            this._gameOverShopBtnRect = { x: shopBtnX, y: shopBtnY, w: shopBtnW, h: shopBtnH };

            this.ctx.save();
            this.ctx.globalAlpha = btnProgress;
            this.ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
            this.ctx.beginPath();
            this.ctx.roundRect(shopBtnX, shopBtnY, shopBtnW, shopBtnH, 10);
            this.ctx.fill();
            this.ctx.strokeStyle = "#fbbf24";
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = "#fbbf24";
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            this.ctx.font = "900 16px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fbbf24";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(`🪙 SHOP  •  ${this.state.adCoins}`, shopBtnX + shopBtnW / 2, shopBtnY + shopBtnH / 2);
            this.ctx.restore();
        }

        // Render shop modal on top of game over if open
        if (this.state.shopOpen) this._renderShop();
    }
    _renderStartScreen() { 
        if (this.isMobile && this.overlay) this.overlay.classList.add('active'); 
        
        const f = this.state.frameCount;
        const breathe = Math.sin(f * 0.04) * 0.5 + 0.5;
        const slowPulse = Math.sin(f * 0.02) * 0.5 + 0.5;
        const heroBreathe = 1 + Math.sin(f * 0.03) * 0.02; // 0.98 - 1.02
        
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        
        // --- HERO: Ready message, rock-solid centered with breathing scale + shimmer ---
        this.ctx.save();
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        let heroFontSize = 64;
        this.ctx.font = `900 ${heroFontSize}px 'Outfit', sans-serif`;
        let measuredW = this.ctx.measureText(this.state.currentReadyMsg).width;
        const maxW = this.canvas.width * 0.85;
        if (measuredW > maxW) {
            heroFontSize = Math.floor(heroFontSize * (maxW / measuredW));
            this.ctx.font = `900 ${heroFontSize}px 'Outfit', sans-serif`;
            measuredW = this.ctx.measureText(this.state.currentReadyMsg).width;
        }

        // Translate origin to draw point, then scale — text draws at local (0,0)
        // so textAlign=center guarantees horizontal centering on cx
        this.ctx.translate(cx, cy - 60);
        this.ctx.scale(heroBreathe, heroBreathe);

        this.ctx.shadowBlur = 30 + (breathe * 20);
        this.ctx.shadowColor = "#a855f7";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 8;
        this.ctx.strokeText(this.state.currentReadyMsg, 0, 0);

        const heroGrad = this.ctx.createLinearGradient(-measuredW/2, 0, measuredW/2, 0);
        heroGrad.addColorStop(0, "#06b6d4");
        heroGrad.addColorStop(0.5, "#a855f7");
        heroGrad.addColorStop(1, "#06b6d4");
        this.ctx.fillStyle = heroGrad;
        this.ctx.fillText(this.state.currentReadyMsg, 0, 0);

        const heroShimmerPos = (f * 0.006) % 1.5 - 0.25;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-atop';
        const shimX = -measuredW/2 + measuredW * heroShimmerPos;
        const shimmerGradHero = this.ctx.createLinearGradient(shimX - 80, 0, shimX + 80, 0);
        shimmerGradHero.addColorStop(0, "rgba(255, 255, 255, 0)");
        shimmerGradHero.addColorStop(0.5, "rgba(255, 255, 255, 0.65)");
        shimmerGradHero.addColorStop(1, "rgba(255, 255, 255, 0)");
        this.ctx.fillStyle = shimmerGradHero;
        this.ctx.fillText(this.state.currentReadyMsg, 0, 0);
        this.ctx.restore();

        this.ctx.restore();
        
        // --- INSTRUCTION CARDS: bigger, bolder ---
        const instructions = this.isMobile 
            ? [
                { icon: "🕊️", label: "FLAP", desc: "TAP SCREEN" },
                { icon: "💣", label: "BOMB", desc: "BOMB BUTTON" }
              ]
            : [
                { icon: "🕊️", label: "FLAP", desc: "SPACE or CLICK" },
                { icon: "💥", label: "BOMB", desc: "SHIFT or R-CLICK" }
              ];
        
        const cardW = 260;
        const cardH = 150;
        const cardGap = 28;
        const totalW = (cardW * 2) + cardGap;
        const startX = cx - totalW / 2;
        const instY = cy + 20;
        
        instructions.forEach((ins, i) => {
            const iX = startX + (i * (cardW + cardGap));
            const accent = i === 0 ? "#06b6d4" : "#a855f7";
            const accentRgb = i === 0 ? "6, 182, 212" : "168, 85, 247";

            // Per-card animation phases (staggered by index)
            const phase = f * 0.04 + i * Math.PI;
            const iconBob = Math.sin(phase) * 4;
            const cardScale = 1 + Math.sin(phase * 0.5) * 0.02;
            const borderPulse = Math.sin(phase * 0.7) * 0.5 + 0.5;

            this.ctx.save();

            // Scale about card center
            const cardCx = iX + cardW / 2;
            const cardCy = instY + cardH / 2;
            this.ctx.translate(cardCx, cardCy);
            this.ctx.scale(cardScale, cardScale);
            this.ctx.translate(-cardCx, -cardCy);

            // Card tint
            this.ctx.fillStyle = `rgba(${accentRgb}, 0.15)`;
            this.ctx.beginPath();
            this.ctx.roundRect(iX, instY, cardW, cardH, 20);
            this.ctx.fill();

            // Dark backing
            this.ctx.fillStyle = "rgba(10, 10, 15, 0.55)";
            this.ctx.beginPath();
            this.ctx.roundRect(iX, instY, cardW, cardH, 20);
            this.ctx.fill();

            // SHIMMER sweep — staggered, runs 1/3 of the time per card
            const shimmerCycle = ((f * 0.012) + i * 0.5) % 3;
            if (shimmerCycle < 1) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.roundRect(iX, instY, cardW, cardH, 20);
                this.ctx.clip();
                const shimW = 110;
                const shimX2 = iX - shimW + (cardW + shimW * 2) * shimmerCycle;
                const cardShimGrad = this.ctx.createLinearGradient(shimX2, 0, shimX2 + shimW, 0);
                cardShimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
                cardShimGrad.addColorStop(0.5, `rgba(${accentRgb}, 0.35)`);
                cardShimGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
                this.ctx.fillStyle = cardShimGrad;
                this.ctx.fillRect(iX, instY, cardW, cardH);
                this.ctx.restore();
            }

            // Glowing border with stronger pulse
            this.ctx.shadowBlur = 20 + borderPulse * 20;
            this.ctx.shadowColor = accent;
            this.ctx.strokeStyle = accent;
            this.ctx.lineWidth = 2.5 + borderPulse * 1.5;
            this.ctx.beginPath();
            this.ctx.roundRect(iX, instY, cardW, cardH, 20);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // Icon (bobbing)
            this.ctx.font = "52px serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(ins.icon, iX + cardW / 2, instY + 48 + iconBob);

            // Label
            this.ctx.font = "900 28px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fff";
            this.ctx.shadowBlur = 8 + borderPulse * 8;
            this.ctx.shadowColor = accent;
            this.ctx.fillText(ins.label, iX + cardW / 2, instY + 100);
            this.ctx.shadowBlur = 0;

            // Description
            this.ctx.font = "bold 13px 'Outfit', sans-serif";
            this.ctx.fillStyle = accent;
            this.ctx.fillText(ins.desc, iX + cardW / 2, instY + 128);

            this.ctx.restore();
        });
        
        // --- HIGH SCORE BADGES ---
        if (this.state.highScore > 0 || this.state.highDirectHits > 0) {
            const badges = [
                { label: "BEST REACH", val: this.state.highScore, color: "#fbbf24" },
                { label: "BEST IMPACT", val: this.state.highDirectHits, color: "#06b6d4" },
                { label: "BEST MISSES", val: this.state.highTotalMisses, color: "#f43f5e" }
            ];
            
            const badgeY = 215;
            const bW = 210;
            const bH = 85;
            const bGap = 20;
            const bTotal = (bW * 3) + (bGap * 2);
            const bStartX = cx - bTotal / 2;
            
            badges.forEach((b, i) => {
                const bX = bStartX + (i * (bW + bGap));
                
                this.ctx.save();
                this.ctx.globalAlpha = 0.9;
                
                this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
                this.ctx.beginPath();
                this.ctx.roundRect(bX, badgeY, bW, bH, 14);
                this.ctx.fill();
                
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = b.color;
                this.ctx.strokeStyle = b.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.roundRect(bX, badgeY, bW, bH, 14);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
                
                this.ctx.font = "bold 13px 'Outfit', sans-serif";
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "top";
                this.ctx.fillText(b.label, bX + bW / 2, badgeY + 14);
                this.ctx.font = "900 42px 'Outfit', sans-serif";
                this.ctx.fillStyle = b.color;
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(b.val, bX + bW / 2, badgeY + 56);
                
                this.ctx.restore();
            });
        }
        
        // --- SPLASH LAYOUT ---
        this._recalculateSplashRects();

        // --- PLAY BUTTON ---
        const play = this._playBtnRect;
        const ctaText = this.isMobile ? "▶ TAP TO PLAY" : "▶ PRESS ENTER TO PLAY";
        const playPressProgress = this._getPressProgress(this.state.playBtnPressed);
        const playClickScale = 0.8 + playPressProgress * 0.2;
        const playClickAlpha = playPressProgress;

        const playHoverLift = this.state.playBtnHover ? 4 : 0;
        const playFocused = this.state.splashFocus === 0;
        const ctaY = play.y + play.h / 2;
        const showShimmerPlay = (this.state.playBtnHover || playFocused) && playClickAlpha > 0.3;
        
        // Click compression transform
        this.ctx.save();
        this.ctx.translate(play.x + play.w/2, ctaY);
        this.ctx.scale(playClickScale, playClickScale);
        this.ctx.translate(-(play.x + play.w/2), -ctaY);
        this.ctx.globalAlpha = playClickAlpha;
        
        // Backing panel
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
        this.ctx.beginPath();
        this.ctx.roundRect(play.x, ctaY - play.h / 2, play.w, play.h, 12);
        this.ctx.fill();
        
        // Pulsing border
        const ctaPulse = Math.sin(f * 0.08) * 0.2 + 0.8;
        const ctaGlow = (playFocused || this.state.playBtnHover) ? 35 : 20;
        this.ctx.shadowBlur = ctaGlow;
        this.ctx.shadowColor = "#06b6d4";
        this.ctx.strokeStyle = "#06b6d4";
        this.ctx.lineWidth = (playFocused || this.state.playBtnHover) ? 3 : 2;
        this.ctx.globalAlpha = playClickAlpha * ctaPulse;
        this.ctx.beginPath();
        this.ctx.roundRect(play.x, ctaY - play.h / 2, play.w, play.h, 12);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Focus ring
        if (playFocused) {
            this.ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(play.x - 5, ctaY - play.h / 2 - 5, play.w + 10, play.h + 10, 15);
            this.ctx.stroke();
        }
        
        // Shimmer
        if (showShimmerPlay) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(play.x, ctaY - play.h / 2, play.w, play.h, 12);
            this.ctx.clip();
            const sPos = (f * 0.015) % 1;
            const sW = 60;
            const sX = play.x - sW + (play.w + sW * 2) * sPos;
            const sGrad = this.ctx.createLinearGradient(sX, 0, sX + sW, 0);
            sGrad.addColorStop(0, "rgba(6, 182, 212, 0)");
            sGrad.addColorStop(0.5, "rgba(6, 182, 212, 0.3)");
            sGrad.addColorStop(1, "rgba(6, 182, 212, 0)");
            this.ctx.fillStyle = sGrad;
            this.ctx.fillRect(play.x, ctaY - play.h / 2, play.w, play.h);
            this.ctx.restore();
        }
        
        // Text
        this.ctx.globalAlpha = playClickAlpha;
        this.ctx.font = "900 24px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#06b6d4";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(ctaText, play.x + play.w/2, ctaY);
        this.ctx.restore();
        
        // --- RENT-A-PIPE™ BUTTON ---
        const rent = this._rentBtnRect;
        const rentPulse = Math.sin(f * 0.05) * 0.5 + 0.5;
        
        // Click compression for rent button
        const rentPressProgress = this._getPressProgress(this.state.rentBtnPressed);
        const rentClickScale = 0.8 + rentPressProgress * 0.2;
        const rentClickAlpha = rentPressProgress;
        
        // Hover lift
        const rentHoverLift = this.state.rentBtnHover ? 4 : 0;
        const rentFocused = this.state.splashFocus === 1;
        const rentY = rent.y;
        const showShimmerRent = (this.state.rentBtnHover || rentFocused) && rentClickAlpha > 0.3;
        
        this.ctx.save();
        const rentBtnCx = rent.x + rent.w / 2;
        const rentBtnCy = rentY + rent.h / 2;
        this.ctx.translate(rentBtnCx, rentBtnCy);
        this.ctx.scale(rentClickScale, rentClickScale);
        this.ctx.translate(-rentBtnCx, -rentBtnCy);
        this.ctx.globalAlpha = rentClickAlpha;
        
        // Outer glow
        const rentGlow = 15 + (rentPulse * 15) + ((this.state.rentBtnHover || rentFocused) ? 20 : 0);
        this.ctx.shadowBlur = rentGlow;
        this.ctx.shadowColor = "#f59e0b";
        this.ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
        this.ctx.beginPath();
        this.ctx.roundRect(rent.x, rentY, rent.w, rent.h, 12);
        this.ctx.fill();
        
        // Gradient fill
        const rentGrad = this.ctx.createLinearGradient(rent.x, rentY, rent.x + rent.w, rentY);
        rentGrad.addColorStop(0, "rgba(245, 158, 11, 0.95)");
        rentGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.95)");
        rentGrad.addColorStop(1, "rgba(245, 158, 11, 0.95)");
        this.ctx.fillStyle = rentGrad;
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.roundRect(rent.x, rentY, rent.w, rent.h, 12);
        this.ctx.fill();
        
        // Border
        this.ctx.strokeStyle = (this.state.rentBtnHover || rentFocused) ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.4)";
        this.ctx.lineWidth = (this.state.rentBtnHover || rentFocused) ? 3 : 2;
        this.ctx.beginPath();
        this.ctx.roundRect(rent.x, rentY, rent.w, rent.h, 12);
        this.ctx.stroke();
        
        // Focus ring
        if (rentFocused) {
            this.ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(rent.x - 5, rentY - 5, rent.w + 10, rent.h + 10, 15);
            this.ctx.stroke();
        }
        
        // Shimmer
        if (showShimmerRent) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(rent.x, rentY, rent.w, rent.h, 12);
            this.ctx.clip();
            const sPos = (f * 0.015) % 1;
            const sW = 70;
            const sX = rent.x - sW + (rent.w + sW * 2) * sPos;
            const sGrad = this.ctx.createLinearGradient(sX, 0, sX + sW, 0);
            sGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
            sGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.4)");
            sGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
            this.ctx.fillStyle = sGrad;
            this.ctx.fillRect(rent.x, rentY, rent.w, rent.h);
            this.ctx.restore();
        }
        
        // Text
        this.ctx.font = "900 20px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fff";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        
        const mainText = "💰  RENT-A-PIPE";
        const priceText = "  $5";
        const tmText = "™";
        
        this.ctx.font = "900 20px 'Outfit', sans-serif";
        const mainW = this.ctx.measureText(mainText).width;
        const priceW = this.ctx.measureText(priceText).width;
        this.ctx.font = "900 11px 'Outfit', sans-serif";
        const tmW = this.ctx.measureText(tmText).width;
        
        const totalTextW = mainW + tmW + priceW;
        const textStartX = rentBtnCx - totalTextW / 2;
        
        this.ctx.font = "900 20px 'Outfit', sans-serif";
        this.ctx.textAlign = "left";
        this.ctx.fillText(mainText, textStartX, rentBtnCy);
        this.ctx.font = "900 11px 'Outfit', sans-serif";
        this.ctx.fillText(tmText, textStartX + mainW, rentBtnCy - 8);
        this.ctx.font = "900 20px 'Outfit', sans-serif";
        this.ctx.fillText(priceText, textStartX + mainW + tmW, rentBtnCy);
        
        this.ctx.restore();
        
        // --- KEYBOARD HINT ---
        if (!this.isMobile) {
            const hintText = "← → ARROWS TO SELECT  •  ENTER TO ACTIVATE";
            this.ctx.save();
            this.ctx.font = "bold 12px 'Outfit', sans-serif";
            const hintW = this.ctx.measureText(hintText).width + 28;
            const hintH = 24;
            const hintX = cx - hintW / 2;
            const hintY = rent.y + rent.h + 18;
            
            // --- SHOP BUTTON ---
            this.ctx.save();
            const shop = this._shopBtnRect;
            const shopHover = this.state.mouseX >= shop.x && this.state.mouseX <= shop.x + shop.w &&
                              this.state.mouseY >= shop.y && this.state.mouseY <= shop.y + shop.h;
            
            this.ctx.fillStyle = shopHover ? "rgba(251, 191, 36, 0.25)" : "rgba(251, 191, 36, 0.15)";
            this.ctx.beginPath();
            this.ctx.roundRect(shop.x, shop.y, shop.w, shop.h, 10);
            this.ctx.fill();
            this.ctx.strokeStyle = "#fbbf24";
            this.ctx.lineWidth = shopHover ? 3 : 2;
            this.ctx.shadowBlur = shopHover ? 20 : 12;
            this.ctx.shadowColor = "#fbbf24";
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            this.ctx.font = "900 18px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fbbf24";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(`🪙 SHOP  •  ${this.state.adCoins}`, shop.x + shop.w / 2, shop.y + shop.h / 2);
            this.ctx.restore();

            if (this.state.shopOpen) this._renderShop();
            
            // Dark backing pill
            this.ctx.fillStyle = "rgba(10, 10, 15, 0.7)";
            this.ctx.beginPath();
            this.ctx.roundRect(hintX, hintY - hintH / 2, hintW, hintH, 12);
            this.ctx.fill();
            
            // Subtle border
            this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(hintX, hintY - hintH / 2, hintW, hintH, 12);
            this.ctx.stroke();
            
            // Text
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(hintText, cx, hintY);
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
        this.state.shopOpen = false;
        this.state.combo = 0;
        this.state.lastHitFrame = 0;
        this.state.missCombo = 0;
        this.state.difficultyMultiplier = 1.0;
        this.state.comboVoiceBag = [];
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
        this.state.runItBackPressed = Date.now();
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
    // NEW:
    _handleResize() {
        this.state.lastRect = this.canvas.getBoundingClientRect();
        this._initHUDGeometry();
        this._recalculateSplashRects();
    }

    _recalculateSplashRects() {
        if (!this.state || this.state.gameRunning || this.state.isGameOver) return;

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // PLAY
        const ctaText = this.isMobile ? "▶ TAP TO PLAY" : "▶ PRESS ENTER TO PLAY";
        this.ctx.save();
        this.ctx.font = "900 24px 'Outfit', sans-serif";
        const ctaW = this.ctx.measureText(ctaText).width + 60;
        const ctaH = 52;
        const ctaX = cx - ctaW / 2;
        const ctaBaseY = cy + 220;
        const playHoverLift = this.state.playBtnHover ? 4 : 0;
        const ctaY = ctaBaseY - playHoverLift;
        this._playBtnRect = { x: ctaX, y: ctaY - ctaH / 2, w: ctaW, h: ctaH };
        this.ctx.restore();

        // RENT
        const rentBtnW = 260;
        const rentBtnH = 58;
        const rentX = cx - rentBtnW / 2;
        const rentBaseY = ctaBaseY + 84;
        const rentHoverLift = this.state.rentBtnHover ? 4 : 0;
        const rentY = rentBaseY - rentHoverLift;
        this._rentBtnRect = { x: rentX, y: rentY, w: rentBtnW, h: rentBtnH };

        // SHOP
        const shopBtnW = 180;
        const shopBtnH = 44;
        const shopX = cx - shopBtnW / 2;
        const shopY = this._rentBtnRect.y + this._rentBtnRect.h + 55;
        this._shopBtnRect = { x: shopX, y: shopY, w: shopBtnW, h: shopBtnH };
    }

    _hexToRgb(hex) {
        const m = (hex || "").match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (!m) return "255, 255, 255";
        return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
    }

    _renderShop() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const w = Math.min(this.canvas.width * 0.75, 640);
        const h = 580;
        const x = cx - w / 2;
        const y = cy - h / 2;
        const f = this.state.frameCount;

        this.ctx.save();

        // Dim backdrop
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Modal background — subtle vertical gradient
        const bgGrad = this.ctx.createLinearGradient(x, y, x, y + h);
        bgGrad.addColorStop(0, "#1f2937");
        bgGrad.addColorStop(1, "#0f172a");
        this.ctx.fillStyle = bgGrad;
        this.ctx.shadowBlur = 50;
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 24);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Pulsing outer border glow
        const borderGlow = 18 + Math.sin(f * 0.05) * 8;
        this.ctx.strokeStyle = "#a855f7";
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = borderGlow;
        this.ctx.shadowColor = "#a855f7";
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 24);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // TITLE with gradient + shimmer sweep
        const titleY = y + 55;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = "900 36px 'Outfit', sans-serif";
        const titleText = "BIRD COSMETICS";
        const titleW = this.ctx.measureText(titleText).width;

        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 5;
        this.ctx.strokeText(titleText, cx, titleY);

        const titleGrad = this.ctx.createLinearGradient(cx - titleW/2, 0, cx + titleW/2, 0);
        titleGrad.addColorStop(0, "#fbbf24");
        titleGrad.addColorStop(0.5, "#f59e0b");
        titleGrad.addColorStop(1, "#fbbf24");
        this.ctx.fillStyle = titleGrad;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = "#f59e0b";
        this.ctx.fillText(titleText, cx, titleY);
        this.ctx.shadowBlur = 0;

        const titleShimPos = (f * 0.008) % 1.5 - 0.25;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-atop';
        const titleShimX = cx - titleW/2 + titleW * titleShimPos;
        const titleShimGrad = this.ctx.createLinearGradient(titleShimX - 60, 0, titleShimX + 60, 0);
        titleShimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        titleShimGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.75)");
        titleShimGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        this.ctx.fillStyle = titleShimGrad;
        this.ctx.fillText(titleText, cx, titleY);
        this.ctx.restore();

        // Coin counter with pulse
        const coinPulse = 1 + Math.sin(f * 0.08) * 0.04;
        this.ctx.save();
        this.ctx.translate(cx, y + 100);
        this.ctx.scale(coinPulse, coinPulse);
        this.ctx.font = "bold 20px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = "#fbbf24";
        this.ctx.fillText(`🪙 ${this.state.adCoins} AD COINS`, 0, 0);
        this.ctx.restore();

        // COLOR ROWS
        const rowH = 58;
        const rowStartY = y + 140;
        const rowPad = 20;

        this.config.shopColors.forEach((c, i) => {
            const rowY = rowStartY + i * rowH;
            const rowX = x + rowPad;
            const rowW = w - rowPad * 2;
            const isOwned = this.state.ownedColors.includes(c.id);
            const isSelected = this.state.selectedColor === c.id;
            const canAfford = this.state.adCoins >= c.cost;

            const isHover = this.state.mouseY >= rowY && this.state.mouseY <= rowY + rowH - 4 &&
                           this.state.mouseX >= rowX && this.state.mouseX <= rowX + rowW;

            const rowPhase = f * 0.05 + i * 0.3;
            const tintHex = c.tint || "#ffffff";
            const tintRgb = this._hexToRgb(tintHex);

            let rowBgAlpha = 0.05;
            let rowXOffset = 0;
            if (isSelected) {
                rowBgAlpha = 0.18 + Math.sin(rowPhase) * 0.04;
            } else if (isHover) {
                rowBgAlpha = 0.14;
                rowXOffset = 8;
            }

            // Row background
            this.ctx.fillStyle = `rgba(${tintRgb}, ${rowBgAlpha})`;
            this.ctx.beginPath();
            this.ctx.roundRect(rowX + rowXOffset, rowY, rowW, rowH - 6, 12);
            this.ctx.fill();

            // Selected row — glowing border in tint color
            if (isSelected) {
                this.ctx.strokeStyle = tintHex;
                this.ctx.lineWidth = 2;
                this.ctx.shadowBlur = 14;
                this.ctx.shadowColor = tintHex;
                this.ctx.beginPath();
                this.ctx.roundRect(rowX + rowXOffset, rowY, rowW, rowH - 6, 12);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
            }

            // Hover shimmer
            if (isHover && !isSelected) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.roundRect(rowX + rowXOffset, rowY, rowW, rowH - 6, 12);
                this.ctx.clip();
                const rowShimPos = (f * 0.015) % 2 - 0.5;
                const rowShimX = rowX + rowW * rowShimPos;
                const rowShimGrad = this.ctx.createLinearGradient(rowShimX - 70, 0, rowShimX + 70, 0);
                rowShimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
                rowShimGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.18)");
                rowShimGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
                this.ctx.fillStyle = rowShimGrad;
                this.ctx.fillRect(rowX, rowY, rowW, rowH);
                this.ctx.restore();
            }

            // Swatch with glow + pulse
            const swatchX = rowX + 34 + rowXOffset;
            const swatchY = rowY + (rowH - 6) / 2;
            const swatchPulse = 1 + Math.sin(rowPhase) * 0.1;
            const swatchR = 14 * swatchPulse;

            this.ctx.fillStyle = tintHex;
            this.ctx.shadowBlur = 16 + (isHover ? 10 : 0);
            this.ctx.shadowColor = tintHex;
            this.ctx.beginPath();
            this.ctx.arc(swatchX, swatchY, swatchR, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Swatch inner highlight
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
            this.ctx.beginPath();
            this.ctx.arc(swatchX - 4, swatchY - 4, swatchR * 0.3, 0, Math.PI * 2);
            this.ctx.fill();

            // Name
            this.ctx.font = "bold 20px 'Outfit', sans-serif";
            this.ctx.fillStyle = (isSelected || isHover) ? "#fff" : "#9ca3af";
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(c.name, swatchX + 30, swatchY);

            // Right-side status/action
            this.ctx.textAlign = "right";
            const rightX = rowX + rowW - 20 + rowXOffset;

            if (isSelected) {
                const badgeW = 120;
                const badgeH = 28;
                const badgeX = rightX - badgeW;
                const badgeY = swatchY - badgeH / 2;
                const badgePulse = 1 + Math.sin(rowPhase * 2) * 0.04;

                this.ctx.save();
                this.ctx.translate(badgeX + badgeW / 2, badgeY + badgeH / 2);
                this.ctx.scale(badgePulse, badgePulse);
                this.ctx.translate(-(badgeX + badgeW / 2), -(badgeY + badgeH / 2));

                this.ctx.fillStyle = "#10b981";
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = "#10b981";
                this.ctx.beginPath();
                this.ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;

                this.ctx.font = "900 14px 'Outfit', sans-serif";
                this.ctx.fillStyle = "#064e3b";
                this.ctx.textAlign = "center";
                this.ctx.fillText("EQUIPPED", badgeX + badgeW / 2, swatchY);
                this.ctx.restore();
            } else if (isOwned) {
                this.ctx.font = "900 18px 'Outfit', sans-serif";
                this.ctx.fillStyle = isHover ? "#93c5fd" : "#3b82f6";
                if (isHover) {
                    this.ctx.shadowBlur = 12;
                    this.ctx.shadowColor = "#60a5fa";
                }
                this.ctx.fillText("SELECT →", rightX, swatchY);
                this.ctx.shadowBlur = 0;
            } else if (canAfford) {
                const buyPulse = 1 + Math.sin(rowPhase * 1.5) * 0.04;
                this.ctx.save();
                this.ctx.translate(rightX, swatchY);
                this.ctx.scale(buyPulse, buyPulse);
                this.ctx.font = "900 18px 'Outfit', sans-serif";
                this.ctx.fillStyle = isHover ? "#fde047" : "#fbbf24";
                this.ctx.textAlign = "right";
                this.ctx.shadowBlur = isHover ? 16 : 10;
                this.ctx.shadowColor = "#fbbf24";
                this.ctx.fillText(`BUY 🪙${c.cost}`, 0, 0);
                this.ctx.restore();
            } else {
                this.ctx.font = "900 18px 'Outfit', sans-serif";
                this.ctx.fillStyle = "#6b7280";
                this.ctx.fillText(`🔒 ${c.cost}`, rightX, swatchY);
            }
        });

        // Close hint
        this.ctx.font = "bold 12px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#6b7280";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("CLICK OUTSIDE OR THE SHOP BUTTON TO CLOSE", cx, y + h - 25);

        this.ctx.restore();
    }

    _handleShopClick(x, y) {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const w = Math.min(this.canvas.width * 0.75, 640);
        const h = 580;
        const modalX = cx - w / 2;
        const modalY = cy - h / 2;

        // Click outside modal closes it
        if (x < modalX || x > modalX + w || y < modalY || y > modalY + h) {
            this.state.shopOpen = false;
            return true;
        }

        const rowH = 58;
        const rowStartY = modalY + 140;
        const clickedRowIndex = Math.floor((y - rowStartY) / rowH);

        if (clickedRowIndex >= 0 && clickedRowIndex < this.config.shopColors.length) {
            const color = this.config.shopColors[clickedRowIndex];
            const isOwned = this.state.ownedColors.includes(color.id);

            if (isOwned) {
                this.state.selectedColor = color.id;
                this._safeStorage('set', 'adBirdSelectedColor', color.id);
                this.playSound('score');
            } else if (this.state.adCoins >= color.cost) {
                this.state.adCoins -= color.cost;
                this.state.ownedColors.push(color.id);
                this.state.selectedColor = color.id;
                this._safeStorage('set', 'adBirdCoins', this.state.adCoins);
                this._safeStorage('set', 'adBirdOwnedColors', JSON.stringify(this.state.ownedColors));
                this._safeStorage('set', 'adBirdSelectedColor', color.id);
                this.playSound('shift');
            }
            return true;
        }
        return false;
    }

    // NEW:
    destroy() {
        window.removeEventListener('keydown', this._handleKeydown);
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener('orientationchange', this._handleResize);
        const it = this.canvas.parentElement || this.canvas;
        it.removeEventListener('mousedown', this._handleInput);
        it.removeEventListener('mousemove', this._handleMouseMove);
        it.removeEventListener('touchstart', this._handleTouchStart);
        if (this.assets && this.assets.music) this.assets.music.pause();
    }
}

