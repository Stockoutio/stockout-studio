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
                return (options.stockAds || window.AdBirdContent.STOCK_ADS).map(text => ({
                    text: text.toUpperCase(),
                    color: colors[Math.floor(Math.random() * colors.length)]
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
                { id: 'cyan', name: 'EMERALD', cost: 2500, tint: '#10b981' },
                { id: 'magenta', name: 'HOT PINK', cost: 8000, tint: '#ec4899' },
                { id: 'gold', name: 'GOLD RUSH', cost: 20000, tint: '#fbbf24' },
                { id: 'purple', name: 'SYNERGY PURPLE', cost: 45000, tint: '#a855f7' },
                { id: 'red', name: 'MARKET RED', cost: 120000, tint: '#f43f5e' }
            ],
            shopTrails: [
                { id: 'none', name: 'NO TRAIL', cost: 0, color: null },
                { id: 'fire', name: 'FIRE', cost: 4500, color: '#f97316' },
                { id: 'neon', name: 'NEON', cost: 12000, color: '#06b6d4' },
                { id: 'money', name: 'MONEY', cost: 30000, color: '#22c55e' },
                { id: 'feathers', name: 'FEATHERS', cost: 60000, color: '#e0e7ff' }
            ],
            shopBombs: [
                { id: 'default', name: 'DEFAULT', cost: 0, tint: '#ffffff' },
                { id: 'nuke', name: 'NUKE', cost: 6000, tint: '#84cc16' },
                { id: 'confetti', name: 'CONFETTI', cost: 15000, tint: '#ec4899' },
                { id: 'bitcoin', name: 'BITCOIN', cost: 36000, tint: '#f59e0b' },
                { id: 'brand', name: 'BRAND DESTRUCTION', cost: 90000, tint: '#f43f5e' }
            ],
            shopPipes: [
                { id: 'default', name: 'DEFAULT', cost: 0, color: null },
                { id: 'gold', name: 'GILDED', cost: 9000, color: '#fbbf24' },
                { id: 'lava', name: 'LAVA', cost: 24000, color: '#ef4444' },
                { id: 'glitch', name: 'GLITCH', cost: 54000, color: '#a855f7' }
            ],
            shopMagnets: [
                { id: 'none', name: 'NO MAGNET', cost: 0, mult: 1.0, tint: '#6b7280' },
                { id: 'small', name: 'POCKET MAGNET', cost: 5000, mult: 1.5, tint: '#60a5fa' },
                { id: 'medium', name: 'HEAVY MAGNET', cost: 18000, mult: 2.2, tint: '#a855f7' },
                { id: 'huge', name: 'MEGA MAGNET', cost: 50000, mult: 3.5, tint: '#fbbf24' }
            ],
            coinTypes: [
                { value: 1,  weight: 60, coreColor: '#fbbf24', edgeColor: '#b45309', face: '$',  r: 14 },
                { value: 2,  weight: 25, coreColor: '#e5e7eb', edgeColor: '#6b7280', face: '2',  r: 15 },
                { value: 5,  weight: 10, coreColor: '#fde047', edgeColor: '#ca8a04', face: '5',  r: 17 },
                { value: 10, weight: 4,  coreColor: '#34d399', edgeColor: '#047857', face: '10', r: 19 },
                { value: 50, weight: 1,  coreColor: '#93c5fd', edgeColor: '#1e40af', face: '50', r: 22 }
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
            currentStreak: parseInt(this._safeStorage('get', 'adBirdStreak')) || 0,
            highStreak: parseInt(this._safeStorage('get', 'adBirdHighStreak')) || 0,
            frameCount: 0, nextPipeFrame: 40, currentWorld: 0, flashOpacity: 0, isMuted: false, bgX: 0, screenShake: 0,
            bombTimer: 0, assetsLoaded: 0, lastRect: null, waitingForGameOver: false, gameOverFrame: 0,
            mouseX: 0, mouseY: 0, runItBackHover: false, gameOverFocus: 0, runItBackPressed: 0,
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
            ownedTrails: JSON.parse(this._safeStorage('get', 'adBirdOwnedTrails') || '["none"]'),
            selectedTrail: this._safeStorage('get', 'adBirdSelectedTrail') || 'none',
            ownedBombs: JSON.parse(this._safeStorage('get', 'adBirdOwnedBombs') || '["default"]'),
            selectedBomb: this._safeStorage('get', 'adBirdSelectedBomb') || 'default',
            ownedPipes: JSON.parse(this._safeStorage('get', 'adBirdOwnedPipes') || '["default"]'),
            selectedPipe: this._safeStorage('get', 'adBirdSelectedPipe') || 'default',
            ownedMagnets: JSON.parse(this._safeStorage('get', 'adBirdOwnedMagnets') || '["none"]'),
            selectedMagnet: this._safeStorage('get', 'adBirdSelectedMagnet') || 'none',
            shopOpen: false,
            shopTab: 'birds',
            shopHoverIndex: -1,
            lastCoinsEarned: 0,
            paidAdsDestroyed: 0,
            coinMagnetTimer: 0,
            doubleBombArmed: false,
            shieldActive: false,
            activePowerupType: null,
            activePowerupTimer: 0,
            portals: [],
            portalData: (() => {
                const p = new URLSearchParams(window.location.search);
                return {
                    isEntry: p.get('portal') === 'true',
                    username: p.get('username') || '',
                    ref: p.get('ref') || '',
                    color: p.get('color') || ''
                };
            })()
        };
        this.state.currentWorld = this._nextWorld();
        this.state.currentReadyMsg = this._nextFromBag('readyMsgBag', 'readyMessages');
        this.player = { x: 320, y: 150, w: 100, h: 100, velocity: 0, flipAngle: 0, isFlipping: false, flipSpeed: 0.25, flipDirection: 1 };
    }

    _initBuffers() {
        this.pipes = []; this.bombs = []; this.bubbles = []; this.floatingTexts = []; this.coins = []; this.portals = [];
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
        // When the tab regains focus (e.g. user returns from Stripe), clear any stuck press animations
        // that would otherwise leave buttons invisible due to stale Date.now() press timestamps.
        window.addEventListener('focus', () => {
            this.state.playBtnPressed = 0;
            this.state.rentBtnPressed = 0;
            this.state.fullscreenPressed = 0;
            this.state.mutePressed = 0;
            this.state.runItBackPressed = 0;
        });
        
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
        // Pre-compute splash rects so mouse hover detection works from frame 0
        this._recalculateSplashRects();
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

        // Mute toggle always works — even during death pause
        if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            this.state.mutePressed = Date.now();
            this.toggleMute();
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
            // Shop open — delegate to shop keyboard handler (nav, select, close)
            if (this._handleShopKey(e)) return;
            
            // Directional keys cycle focus between RUN IT BACK (0) and SHOP (1)
            if (isFocusCycle) {
                e.preventDefault();
                this.state.gameOverFocus = (this.state.gameOverFocus + 1) % 2;
                this.playSound('score');
                return;
            }
            
            // Flap/bomb keys are a fast path — always trigger RUN IT BACK
            if (isFlap || isBomb) {
                e.preventDefault();
                this._triggerButtonExplosion();
                this._resetToSplash();
                return;
            }
            
            // Enter activates whichever button is focused
            if (isEnter || e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                if (this.state.gameOverFocus === 0) {
                    this._triggerButtonExplosion();
                    this._resetToSplash();
                } else {
                    this.state.shopOpen = !this.state.shopOpen;
                    this.playSound('score');
                }
                return;
            }
            return;
        }

        // Splash screen — Option A keyboard nav
        if (!this.state.gameRunning) {
            // Shop open — delegate to shop keyboard handler (nav, select, close)
            if (this._handleShopKey(e)) return;
            // Any direction/WASD cycles focus across PLAY (0), RENT (1), SHOP (2)
            if (isFocusCycle) {
                e.preventDefault();
                const isForward = ['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(e.code) ||
                                  ['d', 'D', 's', 'S'].includes(e.key);
                if (isForward) {
                    this.state.splashFocus = (this.state.splashFocus + 1) % 3;
                } else {
                    this.state.splashFocus = (this.state.splashFocus + 2) % 3;  // -1 mod 3
                }
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
                } else if (this.state.splashFocus === 1) {
                    // RENT
                    this._triggerSplashButtonExplosion('rent');
                    setTimeout(() => {
                        window.open(this._getStripeUrl(), '_blank');
                    }, 300);
                } else {
                    // SHOP — toggle modal
                    this.state.shopOpen = !this.state.shopOpen;
                    this.playSound('score');
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
        
        // Re-fetch rect on every move — cheap, and fixes stale rect when canvas layout shifts
        // (e.g. if CSS loads late on first visit, or the page resizes without a resize event)
        const r = this.canvas.getBoundingClientRect();
        this.state.lastRect = r;

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
        const hoveringSplashShop = this._isOverSplashShopBtn(x, y);
        const hoveringGameOverShop = this._isOverGameOverShopBtn(x, y);
        const hoveringShopClose = this.state.shopOpen && this._shopCloseBtnRect &&
            Math.hypot(x - this._shopCloseBtnRect.cx, y - this._shopCloseBtnRect.cy) < this._shopCloseBtnRect.r + 4;
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
        else if (hoveringSplashShop) this.state.splashFocus = 2;

        // Sync shopHoverIndex to mouse position whenever shop is open.
        // Geometry must match _renderShop exactly: w = min(canvas*0.78, 680), h = 620, rowH = 54,
        // rowStartY = tabY(modalY+105) + tabH(36) + 20 = modalY + 161.
        if (this.state.shopOpen) {
            const modalW = Math.min(this.canvas.width * 0.78, 680);
            const modalX = this.canvas.width / 2 - modalW / 2;
            const modalY = this.canvas.height / 2 - 310;  // modal h = 620
            const rowH = 54;
            const rowStartY = modalY + 161;
            const rowX = modalX + 20;
            const rowW = modalW - 40;
            const items = this._getShopItems();

            if (hoveringShopClose) {
                this.state.shopHoverIndex = -2;
            } else if (y >= rowStartY && x >= rowX && x <= rowX + rowW) {
                const idx = Math.floor((y - rowStartY) / rowH);
                if (idx >= 0 && idx < items.length) {
                    this.state.shopHoverIndex = idx;
                }
            }
        }

        this.canvas.style.cursor = (hoveringRunBack || hoveringPlay || hoveringRent || hoveringFS || hoveringMute || hoveringSplashShop || hoveringGameOverShop || hoveringShopClose) ? 'pointer' : 'default';
    }

    _isOverRunItBack(x, y) {
        if (!this.state.isGameOver) return false;
        
        const btnW = 280;
        const btnH = 64;
        const btnX = (this.canvas.width - btnW) / 2;
        const btnY = this.canvas.height / 2 + 220;
        
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

    _isOverSplashShopBtn(x, y) {
        if (this.state.gameRunning || this.state.isGameOver) return false;
        if (!this._shopBtnRect) return false;
        const r = this._shopBtnRect;
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    _isOverGameOverShopBtn(x, y) {
        if (!this.state.isGameOver) return false;
        if (!this._gameOverShopBtnRect) return false;
        const r = this._gameOverShopBtnRect;
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
        Object.assign(this.state, { gameRunning: true, isGameOver: false, waitingForGameOver: false, score: 0, directHits: 0, totalMisses: 0, lastMissFrame: 0, frameCount: 0, nextPipeFrame: 40, bgX: 0, screenShake: 0, bombTimer: 0, paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], readyMsgBag: [], missMsgBag: [], megaMissMsgBag: [], worldBag: [], stockInARow: 0, particles: [], gameOverFrame: 0, runItBackHover: false, gameOverFocus: 0, runItBackPressed: 0, playBtnHover: false, rentBtnHover: false, playBtnPressed: 0, rentBtnPressed: 0, combo: 0, lastHitFrame: 0, missCombo: 0, difficultyMultiplier: 1.0, comboVoiceBag: [], paidAdsDestroyed: 0, coinMagnetTimer: 0, doubleBombArmed: false, shieldActive: false, activePowerupType: null, activePowerupTimer: 0 });
        this.canvas.style.cursor = 'default';
        Object.assign(this.player, { y: 150, velocity: 0, flipAngle: 0, isFlipping: false });
        this.pipes = []; this.bombs = []; this.floatingTexts = []; this.coins = []; this.portals = [];
        
        // If coming from a portal, spawn a return portal immediately
        if (this.state.portalData.isEntry && this.state.portalData.ref) {
            this._spawnPortal(true); // isReturn = true
        }
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
            const slowRatio = Math.min(1, this.state.slowMoTimer / this.config.slowMoDuration);
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
            if (this.state.shieldActive) {
                this.state.shieldActive = false;
                this.player.y = Math.max(20, Math.min(this.canvas.height - this.player.h - 20, this.player.y));
                this.player.velocity = this.config.lift;
                this.state.flashOpacity = 0.8;
                this._pushFloatingText({
                    x: this.canvas.width / 2, y: this.canvas.height / 2,
                    text: "SHIELD BROKEN!", color: "#fff", scale: 1.6,
                    glow: "#3b82f6", vy: -3, isMega: true, isShivering: true
                });
                this.playSound('shift');
            } else {
                this.gameOver();
            }
        }

        this.state.bgX = (this.state.bgX - this.config.bgSpeed * effectiveDt) % this.canvas.width;
        if (this.state.bombTimer > 0) this.state.bombTimer -= effectiveDt;

        this._updateEntities(effectiveDt);
        // Floating texts are updated inside _updateParticles (called from _loop)

        if (this.state.frameCount >= this.state.nextPipeFrame) {
            this._spawnPipe();
            
            // Occasionally spawn an exit portal (every ~15 pipes)
            if (this.state.score > 0 && this.state.score % 15 === 0 && this.portals.length === 0) {
                this._spawnPortal(false); // isReturn = false (it's an exit)
            }
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
        const cap = this.perfMode ? 180 : 400;
        if (this.state.particles.length > cap) {
            this.state.particles.splice(0, this.state.particles.length - cap);
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
        if (this.state.coinMagnetTimer > 0) this.state.coinMagnetTimer -= dt;
        if (this.state.activePowerupTimer > 0) {
            this.state.activePowerupTimer -= dt;
            if (this.state.activePowerupTimer <= 0) {
                if (this.state.activePowerupType === 'doubleBomb') {
                    this.state.doubleBombArmed = false;
                }
                this.state.activePowerupType = null;
            }
        }
        const scoreRamp = Math.floor(this.state.score / 10) * 0.25;
        const dynamicSpeed = (this.config.pipeSpeed + scoreRamp) * this.state.difficultyMultiplier;

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            
            if (p.shakeTimer > 0) p.shakeTimer -= dt;
            if (p.collapsing && p.shakeTimer <= 0) {
                p.collapseVel += 0.8 * dt;
                p.collapseOffsetY += p.collapseVel * dt;
            }

            // Sparkle particles around active super pipes (throttled on mobile)
            const sparkleGate = this.perfMode ? 6 : 2;
            if (p.isSuper && !p.collapsing && Math.floor(this.state.frameCount) % sparkleGate === 0) {
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
            if (p.isPaid && !p.collapsing && Math.floor(this.state.frameCount) % 5 === 0) {
                this.state.particles.push({
                    x: p.x + p.w / 2 + (Math.random() - 0.5) * p.w,
                    y: Math.random() > 0.5 ? p.y - 5 : p.y + p.gap + 5,
                    vx: (Math.random() - 0.5) * 1,
                    vy: (Math.random() - 0.5) * 1,
                    size: Math.random() * 2 + 1,
                    color: p.ad.color,
                    life: 0.6,
                    isMega: true
                });
            }

            p.x -= dynamicSpeed * dt;
            if (p.isSuper && !p.collapsing) {
                if (p.bobPhase === undefined) p.bobPhase = Math.random() * Math.PI * 2;
                p.bobPhase += 0.04 * dt;
                p.bobOffset = Math.sin(p.bobPhase) * 45;
            }
            if (p.shouldBob && !p.collapsing) {
                p.regBobPhase += 0.03 * dt;
                p.regBobOffset = Math.sin(p.regBobPhase) * 25;
            }
            if (p.highlight > 0) p.highlight *= 0.82;
            p.stains.forEach(s => s.drips.forEach(d => { if (d.len < d.maxLen) d.len += d.speed; }));
            
            const pd = 15; const bx = this.player.x+pd, bw = this.player.w-(pd*2), by = this.player.y+pd, bh = this.player.h-(pd*2);
            
            // NEAR-MISS DETECTION — skip for collapsing pipes (they're not a threat anymore)
            if (!p.collapsing && !p.nearMissed && bx < p.x + p.w && bx + bw > p.x) {
                const topGapEdge = p.y + (p.isSuper ? p.bobOffset : 0) + (p.shouldBob ? p.regBobOffset : 0);
                const bottomGapEdge = p.y + p.gap + (p.isSuper ? p.bobOffset : 0) + (p.shouldBob ? p.regBobOffset : 0);
                const distToTop = by - topGapEdge;
                const distToBottom = bottomGapEdge - (by + bh);
                const closestEdge = Math.min(distToTop, distToBottom);
                if (closestEdge > 0 && closestEdge < 25) {
                    p.nearMissed = true;
                    const isClutch = closestEdge < 10;
                    const fxY = distToTop < distToBottom ? topGapEdge : bottomGapEdge;
                    const particleCount = isClutch ? 30 : 10;
                    const particleColor = isClutch ? "#fbbf24" : "#22d3ee";
                    for (let k = 0; k < particleCount; k++) {
                        this.state.particles.push({
                            x: p.x + p.w / 2 + (Math.random() - 0.5) * p.w,
                            y: fxY + (Math.random() - 0.5) * 20,
                            vx: (Math.random() - 0.5) * (isClutch ? 8 : 4),
                            vy: (Math.random() - 0.5) * (isClutch ? 8 : 4),
                            size: Math.random() * 3 + 1,
                            color: particleColor,
                            life: isClutch ? 1.2 : 0.8,
                            isMega: true
                        });
                    }
                    
                    if (isClutch) {
                        this.state.slowMoTimer = 48;
                        this.state.slowMoStrength = 0.3;
                        this.state.screenShake = Math.max(this.state.screenShake, 12);
                        this._pushFloatingText({
                            x: this.canvas.width / 2,
                            y: this.canvas.height / 2 - 60,
                            text: "CLUTCH!",
                            color: "#fff",
                            scale: 2.0,
                            glow: "#fbbf24",
                            vy: -3,
                            isMega: true,
                            isShivering: true
                        });
                        // Coin burst reward
                        const coinType = this._pickCoinType();
                        for (let k = 0; k < 4; k++) {
                            const burstType = this._pickCoinType();
                            this.coins.push({
                                x: this.player.x + this.player.w / 2 + (Math.random() - 0.5) * 60,
                                y: this.player.y - 60 - Math.random() * 40,
                                r: burstType.r,
                                value: burstType.value,
                                coreColor: burstType.coreColor,
                                edgeColor: burstType.edgeColor,
                                face: burstType.face,
                                collected: false,
                                spin: Math.random() * Math.PI * 2,
                                bob: Math.random() * Math.PI * 2,
                                vy: 1 + Math.random() * 2,
                                noScroll: true
                            });
                        }
                        this._playTone({ type: 'sine', freq: [400, 1500], vol: 0.4, dur: 0.3 });
                    } else {
                        const nearMissMsgs = ["NICE!", "THREADED IT", "TOO CLOSE", "DAMN"];
                        this._pushFloatingText({
                            x: this.player.x + this.player.w / 2,
                            y: this.player.y - 20,
                            text: nearMissMsgs[Math.floor(Math.random() * nearMissMsgs.length)],
                            color: "#22d3ee",
                            scale: 0.9,
                            glow: "#06b6d4",
                            vy: -2
                        });
                        this._playTone({ type: 'sine', freq: [600, 900], vol: 0.2, dur: 0.08 });
                    }
                }
            }

            // Death collision — skip for collapsing pipes so bombed pipes never kill the player
            if (!p.collapsing && !p.isPowerup && bx < p.x+p.w && bx+bw > p.x && (by < (p.y + (p.isSuper ? p.bobOffset : 0) + (p.shouldBob ? p.regBobOffset : 0)) || by+bh > (p.y + p.gap + (p.isSuper ? p.bobOffset : 0) + (p.shouldBob ? p.regBobOffset : 0)))) {
                if (this.state.shieldActive) {
                    this.state.shieldActive = false;
                    this.state.screenShake = 25;
                    this.state.flashOpacity = 0.8;
                    p.shakeTimer = 18;
                    p.collapsing = true;
                    this._pushFloatingText({
                        x: this.canvas.width / 2,
                        y: this.canvas.height / 2,
                        text: "SHIELD BROKEN!",
                        color: "#fff",
                        scale: 1.6,
                        glow: "#3b82f6",
                        vy: -3,
                        isMega: true,
                        isShivering: true
                    });
                    for (let k = 0; k < 40; k++) {
                        const ang = Math.random() * Math.PI * 2;
                        const sp = Math.random() * 14 + 4;
                        this.state.particles.push({
                            x: this.player.x + this.player.w / 2,
                            y: this.player.y + this.player.h / 2,
                            vx: Math.cos(ang) * sp,
                            vy: Math.sin(ang) * sp,
                            size: Math.random() * 5 + 2,
                            color: Math.random() > 0.5 ? "#3b82f6" : "#60a5fa",
                            life: 1.0,
                            isMega: true
                        });
                    }
                    this.playSound('shift');
                } else {
                    this.gameOver();
                    return;
                }
            }
            if (!p.scored && p.x + p.w < this.player.x) {
                p.scored = true; p.highlight = 1.0;
                if (p.isPowerup) {
                    this._activatePowerup(p.powerupType);
                } else if (p.isSuper) {
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
            
            // Grant miss-immunity if this bomb passes through the x-range of a collapsing pipe.
            // Prevents combo-kill when a second bomb would have hit an already-destroyed pipe.
            // Once set, immune stays true for the rest of this bomb's lifetime.
            if (!b.immune) {
                for (const p of this.pipes) {
                    if (p.collapsing && b.x > p.x - 10 && b.x < p.x + p.w + 10) {
                        b.immune = true;
                        break;
                    }
                }
            }
            
            for (const p of this.pipes) { 
                // Skip collapsing pipes — already destroyed, can't be re-bombed
                if (p.collapsing) continue;
                if (b.x > p.x && b.x < p.x + p.w && (b.y < (p.y + (p.isSuper ? p.bobOffset : 0) + (p.shouldBob ? p.regBobOffset : 0)) || b.y > (p.y + p.gap + (p.isSuper ? p.bobOffset : 0) + (p.shouldBob ? p.regBobOffset : 0)))) { 
                    this._createSplat(p, b.x, b.y, b.scale); 
                    hit = true; break; 
                } 
            } 
            if (hit) {
                this.state.directHits++;
                this.bombs.splice(i, 1);
            }
            else if (b.y > this.canvas.height) {
                // Immune bomb — would have hit a pipe that was already mid-collapse. Silent remove.
                if (b.immune) {
                    this.bombs.splice(i, 1);
                    continue;
                }
                // MISS!
                const isGiga = b.scale >= 5.0;
                const msg = isGiga ? this._nextFromBag('megaMissMsgBag', 'megaMissMessages') : this._nextFromBag('missMsgBag', 'missMessages');
                
                this._pushFloatingText({
                    x: b.x, y: this.canvas.height - 30, text: msg,
                    color: "#9ca3af", vy: -0.5, vx: (Math.random() - 0.5) * 2,
                    scale: isGiga ? 1.4 : 0.8,
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
            b.x -= b.speed * dt; 
            b.bobPhase += b.bobSpeed * dt;
            if (b.x < -20) { 
                b.x = this.canvas.width + 20; 
                b.y = Math.random() * this.canvas.height;
            } 
        });

        // COINS — move, collect, expire
        const dynamicSpeedForCoins = (this.config.pipeSpeed + Math.floor(this.state.score / 10) * 0.25) * this.state.difficultyMultiplier;
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const c = this.coins[i];
            if (c.noScroll) {
                c.x -= 1.5 * dt;
            } else {
                c.x -= dynamicSpeedForCoins * dt;
            }
            if (c.vy !== undefined) {
                c.y += c.vy * dt;
                c.vy += 0.2 * dt;
            }
            if (this.state.coinMagnetTimer > 0) {
                const pcx = this.player.x + this.player.w / 2;
                const pcy = this.player.y + this.player.h / 2;
                const dx = pcx - c.x;
                const dy = pcy - c.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0 && dist < 500) {
                    const pull = 0.18 * dt * Math.min(1, 400 / dist);
                    c.x += dx * pull;
                    c.y += dy * pull;
                }
            }
            c.spin += 0.15 * dt;
            c.bob += 0.08 * dt;

            if (c.collected) {
                this.coins.splice(i, 1);
                continue;
            }

            // Pickup — circle vs player AABB
            const pcx = this.player.x + this.player.w / 2;
            const pcy = this.player.y + this.player.h / 2;
            const dx = c.x - pcx;
            const dy = c.y - pcy;
            const magnetDef = this.config.shopMagnets.find(m => m.id === this.state.selectedMagnet);
            const magnetMult = magnetDef ? magnetDef.mult : 1.0;
            const effectiveRadius = (c.r + this.player.w / 2) * magnetMult;
            if (dx * dx + dy * dy < effectiveRadius * effectiveRadius) {
                c.collected = true;
                const comboMult = Math.max(1, this.state.combo);
                const earned = (c.value || 1) * comboMult;
                this.state.adCoins += earned;
                this._safeStorage('set', 'adBirdCoins', this.state.adCoins);

                // Sparkle burst — scales slightly with value
                const sparkCount = Math.min(30, 10 + (c.value || 1) * 2);
                for (let k = 0; k < sparkCount; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const sp = Math.random() * 7 + 2;
                    this.state.particles.push({
                        x: c.x, y: c.y,
                        vx: Math.cos(ang) * sp,
                        vy: Math.sin(ang) * sp,
                        size: Math.random() * 3 + 1,
                        color: Math.random() > 0.5 ? c.coreColor || '#fbbf24' : "#fff",
                        life: 0.7,
                        isMega: true
                    });
                }

                const multText = comboMult > 1 ? ` ×${comboMult}` : "";
                this._pushFloatingText({
                    x: c.x, y: c.y - 20,
                    text: `+${earned} 💰${multText}`,
                    color: c.coreColor || "#fbbf24",
                    glow: c.edgeColor || "#f59e0b",
                    scale: 0.9 + Math.min(0.6, (c.value || 1) / 50),
                    vy: -2
                });

                // Higher-value coins get a deeper, more satisfying pitch
                const basePitch = 900 + (c.value || 1) * 30;
                this._playTone({ type: 'sine', freq: [basePitch, basePitch + 500], vol: 0.2, dur: 0.12 });
                continue;
            }

            if (c.x < -40 || c.y > this.canvas.height + 100) this.coins.splice(i, 1);
        }

        // --- PORTAL UPDATES & COLLISIONS ---
        for (let i = this.portals.length - 1; i >= 0; i--) {
            const pr = this.portals[i];
            pr.x -= dynamicSpeed * dt;
            pr.angle += 0.05 * dt;

            // Collision check
            const pd = 20;
            const px = this.player.x + pd, py = this.player.y + pd, pw = this.player.w - pd*2, ph = this.player.h - pd*2;
            if (px < pr.x + pr.w && px + pw > pr.x && py < pr.y + pr.h && py + ph > pr.y) {
                if (pr.isReturn) {
                    // Back to sender!
                    window.location.href = this.state.portalData.ref;
                } else {
                    // To the Jam Hub!
                    this._triggerPortalExit();
                }
            }

            if (pr.x < -200) this.portals.splice(i, 1);
        }
    }

    _pickCoinType() {
        const types = this.config.coinTypes;
        const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const t of types) {
            roll -= t.weight;
            if (roll <= 0) return t;
        }
        return types[0];  // fallback
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
        const isSuper = this.state.score >= 10 && Math.random() < 0.09;
        const isPowerup = !isSuper && this.state.score >= 5 && Math.random() < 0.06;
        const powerupTypes = ['magnet', 'doubleBomb', 'shield'];
        const powerupType = isPowerup ? powerupTypes[Math.floor(Math.random() * powerupTypes.length)] : null;
        
        let ad;
        if (isSuper) {
            ad = { text: "JACKPOT", color: "#fbbf24" };
        } else if (isPowerup) {
            const labels = { magnet: "COIN MAGNET", doubleBomb: "DOUBLE BOMB", shield: "SHIELD" };
            ad = { text: labels[powerupType], color: "#3b82f6" };
        } else {
            ad = this._nextAd();
        }
        
        this.pipes.push({ 
            x: this.canvas.width, y: h, w: this.config.pipeWidth, gap: gap, ad: ad, 
            scored: false, highlight: 0, stains: [],
            shakeTimer: 0, collapsing: false, collapseOffsetY: 0, collapseVel: 0,
            nearMissed: false,
            isSuper: isSuper,
            isPowerup: isPowerup,
            powerupType: powerupType,
            bobOffset: 0,
            bobPhase: Math.random() * Math.PI * 2,
            isPaid: !isSuper && !!ad.isPaid,
            shouldBob: !isSuper && Math.random() < 0.3,
            regBobOffset: 0,
            regBobPhase: Math.random() * Math.PI * 2,
        });

        // Spawn a coin mid-gap 60% of the time, between this pipe and the next
        if (!isSuper && Math.random() < 0.6) {
            const coinType = this._pickCoinType();
            const coinY = h + 30 + Math.random() * (gap - 60);

            // Start at +250 past this pipe, then push further right if it would land inside ANY existing pipe
            let coinX = this.canvas.width + 250;
            const coinR = coinType.r;
            let safeX = false;
            let attempts = 0;
            while (!safeX && attempts < 8) {
                safeX = true;
                for (const otherPipe of this.pipes) {
                    const overlapsX = (coinX + coinR) > otherPipe.x && (coinX - coinR) < otherPipe.x + otherPipe.w;
                    const insideSolidY = coinY < otherPipe.y || coinY > otherPipe.y + otherPipe.gap;
                    if (overlapsX && insideSolidY) {
                        coinX = otherPipe.x + otherPipe.w + 60 + coinR;
                        safeX = false;
                        break;
                    }
                }
                attempts++;
            }

            this.coins.push({
                x: coinX,
                y: coinY,
                r: coinR,
                value: coinType.value,
                coreColor: coinType.coreColor,
                edgeColor: coinType.edgeColor,
                face: coinType.face,
                collected: false,
                spin: Math.random() * Math.PI * 2,
                bob: Math.random() * Math.PI * 2
            });
        }
    }

    /* --- RENDERING --- */

    _draw() {
        this.ctx.save(); if (this.state.screenShake > 0.5) this.ctx.translate((Math.random()-0.5)*this.state.screenShake, (Math.random()-0.5)*this.state.screenShake);
        this.ctx.clearRect(-40, -40, this.canvas.width+80, this.canvas.height+80);
        this._renderWorld(); this._renderMidground(); this._renderPipes(); this._renderCoins(); this._renderBombs(); this._renderPortals(); 
        if (this.state.gameRunning || this.state.isGameOver) this._renderPlayer();
        this._renderParticles(); this._renderFloatingTexts(); this._renderOverlay();
        this.ctx.restore();
    }

    _renderPipes() {
        this.pipes.forEach(p => {
            const shakeX = p.shakeTimer > 0 ? (Math.random() - 0.5) * 12 : 0;
            const shakeY = p.shakeTimer > 0 ? (Math.random() - 0.5) * 12 : 0;
            const collapseY = p.collapseOffsetY || 0;
            const bobY = (p.isSuper && !p.collapsing ? (p.bobOffset || 0) : 0) + (p.shouldBob && !p.collapsing ? (p.regBobOffset || 0) : 0);

            if (!p.collapsing) {
                this.ctx.save();
                this.ctx.translate(shakeX, shakeY + bobY);
                if (p.isSuper) {
                    this._drawSuperPipeBody(p);
                    this._drawPipeBorders(p, "#fef3c7", 5);
                    this._drawPipeCaps(p, "#fbbf24", 5, 22);
                    this._drawPipeStains(p, 5);
                    this._drawSuperPipeLabel(p);
                } else if (p.isPowerup) {
                    const colors = { magnet: "#fbbf24", doubleBomb: "#f43f5e", shield: "#3b82f6" };
                    const glowColor = colors[p.powerupType] || "#3b82f6";
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.45 + Math.sin(this.state.frameCount * 0.1) * 0.15;
                    this.ctx.fillStyle = glowColor;
                    this.ctx.fillRect(p.x, 0, p.w, p.y);
                    this.ctx.fillRect(p.x, p.y + p.gap, p.w, this.canvas.height);
                    this.ctx.restore();
                    this._drawPipeBorders(p, glowColor, 4);
                    this._drawPipeCaps(p, glowColor, 4, 20);
                    this._drawPipeLabel(p, glowColor);
                } else {
                    const borderWidth = p.isPaid ? 5 : 3;
                    this._drawPipeBody(p);
                    this._drawPipeBorders(p, p.ad.color, borderWidth);
                    this._drawPipeCaps(p, p.ad.color, borderWidth, p.isPaid ? 22 : 18);
                    this._drawPipeStains(p, borderWidth);
                    this._drawPipeLabel(p, p.ad.color);
                }
                this.ctx.restore();
                return;
            }

            // Collapsing pipe — render top and bottom halves separately
            // so only the bottom falls while the top stays rooted to the ceiling

            // TOP HALF — stays in place, fades out as bottom clears the screen
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, 1 - collapseY / 400);
            this.ctx.translate(shakeX, shakeY + bobY);
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
            this.ctx.translate(shakeX, shakeY + collapseY + bobY);
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
        this.ctx.fillRect(p.x, -100, p.w, p.y + 100);
        this.ctx.fillRect(p.x, p.y + p.gap, p.w, this.canvas.height + 100);
    }

    _drawPipeBorders(p, gc, bW) {
        this.ctx.save();
        if (p.highlight > 0.1) {
            this.ctx.shadowBlur = 12 * p.highlight;
            this.ctx.shadowColor = "#fff";
            this.ctx.fillStyle = `rgba(255, 255, 255, ${p.highlight})`;
            this.ctx.fillRect(p.x - bW - 2, -100, bW + 4, p.y + 100);
            this.ctx.fillRect(p.x + p.w - 2, -100, bW + 4, p.y + 100);
            this.ctx.fillRect(p.x - bW - 2, p.y + p.gap, bW + 4, this.canvas.height + 100);
            this.ctx.fillRect(p.x + p.w - 2, p.y + p.gap, bW + 4, this.canvas.height + 100);
        }
        this.ctx.fillStyle = gc;
        this.ctx.fillRect(p.x - bW, -100, bW, p.y + 100);
        this.ctx.fillRect(p.x + p.w, -100, bW, p.y + 100);
        this.ctx.fillRect(p.x - bW, p.y + p.gap, bW, this.canvas.height + 100);
        this.ctx.fillRect(p.x + p.w, p.y + p.gap, bW, this.canvas.height + 100);
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
                this.ctx.fillStyle = s.tint ? s.tint : "rgba(255, 255, 255, 0.9)";
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

    _drawSuperPipeBody(p) {
        const f = this.state.frameCount;
        const pulse = Math.sin(f * 0.08) * 0.15 + 0.85;

        // Animated vertical gradient — gold at edges, bright yellow center
        const drawHalf = (yStart, yEnd) => {
            const grad = this.ctx.createLinearGradient(p.x, yStart, p.x + p.w, yStart);
            grad.addColorStop(0, `rgba(180, 130, 20, ${pulse})`);
            grad.addColorStop(0.5, `rgba(253, 224, 71, ${pulse})`);
            grad.addColorStop(1, `rgba(180, 130, 20, ${pulse})`);
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(p.x, yStart, p.w, yEnd - yStart);
        };
        drawHalf(-100, p.y);
        drawHalf(p.y + p.gap, this.canvas.height + 100);

        // Diagonal shimmer stripes overlay
        this.ctx.save();
        this.ctx.globalAlpha = 0.25;
        const stripeOffset = (f * 1.2) % 40;
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 4;
        for (let yy = -40 + stripeOffset; yy < this.canvas.height + 40; yy += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x - 10, yy);
            this.ctx.lineTo(p.x + p.w + 10, yy + p.w + 20);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    _drawSuperPipeLabel(p) {
        const f = this.state.frameCount;
        const pulse = 1 + Math.sin(f * 0.12) * 0.08;

        this.ctx.save();
        this.ctx.translate(p.x + p.w / 2, p.y + p.gap + (this.canvas.height - (p.y + p.gap)) / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.scale(pulse, pulse);
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        const labelText = "💰 JACKPOT 💰";
        this.ctx.font = "900 22px 'Outfit', sans-serif";

        // Heavy stroke
        this.ctx.strokeStyle = "#78350f";
        this.ctx.lineWidth = 5;
        this.ctx.strokeText(labelText, 0, 0);

        // Gradient fill — bright white core, gold edges
        const textW = this.ctx.measureText(labelText).width;
        const labelGrad = this.ctx.createLinearGradient(-textW / 2, 0, textW / 2, 0);
        labelGrad.addColorStop(0, "#fbbf24");
        labelGrad.addColorStop(0.5, "#fff");
        labelGrad.addColorStop(1, "#fbbf24");
        this.ctx.fillStyle = labelGrad;
        this.ctx.shadowColor = "#f59e0b";
        this.ctx.shadowBlur = 18;
        this.ctx.fillText(labelText, 0, 0);

        // Swept shimmer on top
        const shimPos = (f * 0.015) % 1.5 - 0.25;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-atop';
        const shimX = -textW / 2 + textW * shimPos;
        const shimGrad = this.ctx.createLinearGradient(shimX - 40, 0, shimX + 40, 0);
        shimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        shimGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
        shimGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        this.ctx.fillStyle = shimGrad;
        this.ctx.fillText(labelText, 0, 0);
        this.ctx.restore();

        this.ctx.restore();
    }

    _renderHUD() {
        if (!this.state.gameRunning && !this.state.isGameOver) {
            // Skip main score on splash — streak badge takes this slot
        } else {
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
        }

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

        // LIVE COIN COUNTER — below misses
        this.ctx.font = "bold 14px 'Outfit', sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.fillText("💰 AD COINS", padding, padding + 160);
        this.ctx.font = "bold 28px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.shadowBlur = 14;
        this.ctx.shadowColor = "#fbbf24";
        this.ctx.fillText(this.state.adCoins, padding, padding + 180);
        this.ctx.shadowBlur = 0;

        let nextIndicatorY = padding + 240;

        if (this.state.activePowerupType === 'magnet' || this.state.activePowerupType === 'doubleBomb') {
            const labels = { magnet: "🧲 COIN MAGNET", doubleBomb: "💣💣 DOUBLE BOMB" };
            const colors = { magnet: "#fbbf24", doubleBomb: "#f43f5e" };
            const lbl = labels[this.state.activePowerupType];
            const col = colors[this.state.activePowerupType];
            this.ctx.font = "bold 14px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            this.ctx.shadowBlur = 0;
            this.ctx.fillText("ACTIVE POWER-UP", padding, nextIndicatorY);
            this.ctx.font = "bold 20px 'Outfit', sans-serif";
            this.ctx.fillStyle = col;
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = col;
            this.ctx.fillText(lbl, padding, nextIndicatorY + 20);
            const barW = 200;
            const barH = 6;
            const progress = Math.max(0, Math.min(1, this.state.activePowerupTimer / 300));
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
            this.ctx.fillRect(padding, nextIndicatorY + 50, barW, barH);
            this.ctx.fillStyle = col;
            this.ctx.fillRect(padding, nextIndicatorY + 50, barW * progress, barH);
            nextIndicatorY += 80;
        }

        if (this.state.shieldActive) {
            const sCol = "#3b82f6";
            const pulse = 0.75 + Math.sin(this.state.frameCount * 0.1) * 0.2;
            this.ctx.font = "bold 14px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            this.ctx.shadowBlur = 0;
            this.ctx.fillText("ACTIVE POWER-UP", padding, nextIndicatorY);
            this.ctx.save();
            this.ctx.globalAlpha = pulse;
            this.ctx.font = "bold 20px 'Outfit', sans-serif";
            this.ctx.fillStyle = sCol;
            this.ctx.shadowBlur = 14;
            this.ctx.shadowColor = sCol;
            this.ctx.fillText("🛡️ SHIELD", padding, nextIndicatorY + 20);
            this.ctx.restore();
        }
        
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
        if (p.isPaid) this.state.paidAdsDestroyed++;
        
        if (isMega) {
            // The bombed pipe always collapses
            p.shakeTimer = 18;
            p.collapsing = true;
            this.state.slowMoTimer = this.config.slowMoDuration;
            this.state.slowMoStrength = this.config.slowMoFactor;
            
            // CHAIN REACTION — only triggers when player has built up a 10+ combo.
            // Feels like a screen-clear reward for high streaks, not a constant chaos generator.
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
                    this._pushFloatingText({
                        x: this.canvas.width / 2,
                        y: this.canvas.height / 2 + 60,
                        text: "CHAIN REACTION!",
                        color: "#fbbf24",
                        scale: 1.6,
                        glow: "#f59e0b",
                        vy: -3,
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
        
        const pipeSkin = this.config.shopPipes.find(s => s.id === this.state.selectedPipe);
        const stainTint = pipeSkin && pipeSkin.color ? pipeSkin.color : null;
        p.stains.push({ 
            relY: by, xOff: bx-p.x, 
            size: (Math.random()*8+12) * scale, 
            tint: stainTint,
            drips: Array.from({length:3},()=>({
                xOff:(Math.random()-0.5)*20,
                len:0,
                maxLen:(40+Math.random()*60) * scale,
                speed:(1.0+Math.random()*1.5) * scale,
                w:(3+Math.random()*4) * scale
            })) 
        }); 
        let hitMsg, align = "center", tx = bx;
        if (isMega) {
            const mega = ["MEGA SPLAT", "GIGA SPLAT", "AD-POCALYPSE", "ULTRA-BILL", "MONSTER SPLAT", "SIGN DESTROYER", "MARKET CRASHED", "KPIs CRUSHED", "BRAND DESTRUCTION", "TOTAL COVERAGE"];
            hitMsg = mega[Math.floor(Math.random()*mega.length)];
            if (bx < 280) { align = "left"; tx = 20; }
            else if (bx > this.canvas.width - 280) { align = "right"; tx = this.canvas.width - 20; }
        } else {
            hitMsg = this._nextFromBag('hitMsgBag', 'hitMessages');
        }

        this._pushFloatingText({
            x: tx, y: by - 40,
            vy: isMega ? -4 : 0,
            scale: isMega ? 1.4 : 1,
            vx: (Math.random()-0.5)*(isMega ? 4 : 2),
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
                this._pushFloatingText({
                    x: this.canvas.width / 2,
                    y: this.canvas.height / 2 - 40,
                    text: voiceLine,
                    color: "#fff",
                    scale: 1.8,
                    glow: "#a855f7",
                    vy: -2,
                    isMega: true,
                    isShivering: true
                });
                this.state.screenShake = Math.max(this.state.screenShake, 15);
                this.playSound('shift');
            }
        }
    }

    _triggerSuperPipePass() {
        this.state.score += 8;
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
        
        this._pushFloatingText({
            x: this.canvas.width / 2,
            y: this.canvas.height / 2 - 20,
            text: "JACKPOT! +8",
            color: "#fff",
            scale: 2.2,
            glow: "#fbbf24",
            vy: -3,
            isMega: true,
            isShivering: true
        });
        
        // The +8 bump may have crossed a world-shift milestone (e.g. 7 → 15 crosses 10).
        // Check milestone tiers rather than exact multiple.
        const prevMilestone = Math.floor((this.state.score - 8) / this.config.worldShiftInterval);
        const newMilestone = Math.floor(this.state.score / this.config.worldShiftInterval);
        this.playSound('shift');
        if (newMilestone > prevMilestone) this._shiftWorld();

        // Coin shower — rain a burst of mid-value coins from the top
        const comboShowerBonus = Math.min(20, Math.floor(this.state.combo / 2));
        const showerCount = 10 + comboShowerBonus;
        for (let i = 0; i < showerCount; i++) {
            const coinType = this._pickCoinType();
            this.coins.push({
                x: this.canvas.width * 0.5 + (Math.random() - 0.5) * 550,
                y: -50 - i * 30,
                r: coinType.r,
                value: coinType.value,
                coreColor: coinType.coreColor,
                edgeColor: coinType.edgeColor,
                face: coinType.face,
                collected: false,
                spin: Math.random() * Math.PI * 2,
                bob: Math.random() * Math.PI * 2,
                vy: 3 + Math.random() * 3,
                noScroll: true
            });
        }
    }

    _activatePowerup(type) {
        this.state.screenShake = 15;
        this.state.flashOpacity = 0.5;
        const labels = { magnet: "COIN MAGNET!", doubleBomb: "DOUBLE BOMB ARMED!", shield: "SHIELD UP!" };
        const colors = { magnet: "#fbbf24", doubleBomb: "#f43f5e", shield: "#3b82f6" };

        if (type === 'magnet') {
            this.state.activePowerupType = 'magnet';
            this.state.activePowerupTimer = 300;
            this.state.coinMagnetTimer = 300;
            this._pushFloatingText({
                x: this.canvas.width / 2, y: this.canvas.height / 2 - 40,
                text: labels[type], color: "#fff", scale: 1.8,
                glow: colors[type], vy: -3, isMega: true, isShivering: true
            });
        } else if (type === 'doubleBomb') {
            this.state.activePowerupType = 'doubleBomb';
            this.state.activePowerupTimer = 300;
            this.state.doubleBombArmed = true;
            this._pushFloatingText({
                x: this.canvas.width / 2, y: this.canvas.height / 2 - 40,
                text: labels[type], color: "#fff", scale: 1.8,
                glow: colors[type], vy: -3, isMega: true, isShivering: true
            });
        } else if (type === 'shield') {
            if (this.state.shieldActive) {
                // Already have shield — convert to coin rain. Don't touch activePowerupType/Timer.
                this._pushFloatingText({
                    x: this.canvas.width / 2, y: this.canvas.height / 2 - 40,
                    text: "DOUBLE SHIELD → COIN RAIN!", color: "#fff", scale: 1.6,
                    glow: "#fbbf24", vy: -3, isMega: true, isShivering: true
                });
                const showerCount = 14;
                for (let i = 0; i < showerCount; i++) {
                    const coinType = this._pickCoinType();
                    this.coins.push({
                        x: this.canvas.width * 0.5 + (Math.random() - 0.5) * 550,
                        y: -50 - i * 30,
                        r: coinType.r,
                        value: coinType.value,
                        coreColor: coinType.coreColor,
                        edgeColor: coinType.edgeColor,
                        face: coinType.face,
                        collected: false,
                        spin: Math.random() * Math.PI * 2,
                        bob: Math.random() * Math.PI * 2,
                        vy: 3 + Math.random() * 3,
                        noScroll: true
                    });
                }
                this.state.flashOpacity = 0.9;
                this.state.screenShake = 25;
            } else {
                this.state.shieldActive = true;
                this._pushFloatingText({
                    x: this.canvas.width / 2, y: this.canvas.height / 2 - 40,
                    text: labels[type], color: "#fff", scale: 1.8,
                    glow: colors[type], vy: -3, isMega: true, isShivering: true
                });
            }
        }
        this.playSound('shift');
    }

    gameOver() { 
        if (this.state.isGameOver || this.state.waitingForGameOver) return; 
        if (navigator.vibrate) {
            try { navigator.vibrate([50, 30, 100]); } catch(e) {}
        } 
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

            if (this.state.score >= 5) {
                this.state.currentStreak++;
                if (this.state.currentStreak > this.state.highStreak) {
                    this.state.highStreak = this.state.currentStreak;
                    this._safeStorage('set', 'adBirdHighStreak', this.state.highStreak);
                }
            } else {
                this.state.currentStreak = 0;
            }
            this._safeStorage('set', 'adBirdStreak', this.state.currentStreak);

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
        if (navigator.vibrate) { try { navigator.vibrate(20); } catch(e) {} }
        let scale;
        if (this.state.doubleBombArmed) {
            scale = 5.5;
            this.state.doubleBombArmed = false;
            if (this.state.activePowerupType === 'doubleBomb') {
                this.state.activePowerupType = null;
                this.state.activePowerupTimer = 0;
            }
        } else {
            scale = 0.5 + Math.pow(Math.random(), 2.5) * 5.5;
        }
        const bombSkin = this.config.shopBombs.find(b => b.id === this.state.selectedBomb);
        const bombTint = bombSkin && bombSkin.tint ? bombSkin.tint : null;
        this.bombs.push({ x: this.player.x+this.player.w/2, y: this.player.y+this.player.h-10, w: 15 * scale, h: 20 * scale, speed: 8, scale: scale, tint: bombTint });
        this.state.bombTimer = this.config.bombCooldown;
    }
    _renderWorld() { 
        const bg = this.assets.worlds[this.state.currentWorld]; 
        if (bg && bg.complete) { 
            const rx = this.state.bgX; 
            this.ctx.drawImage(bg, rx, 0, this.canvas.width + 2, this.canvas.height); 
            this.ctx.drawImage(bg, rx + this.canvas.width, 0, this.canvas.width, this.canvas.height); 
        } if (this.state.flashOpacity > 0) { this.ctx.fillStyle = `rgba(255, 255, 255, ${this.state.flashOpacity})`; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.state.flashOpacity -= 0.05; } }
    _renderCoins() {
        if (!this.coins || this.coins.length === 0) return;
        const f = this.state.frameCount;
        this.coins.forEach(c => {
            const bobY = Math.sin(c.bob) * 4;
            const cy = c.y + bobY;
            const widthScale = Math.abs(Math.cos(c.spin));
            const coreColor = c.coreColor || '#fbbf24';
            const edgeColor = c.edgeColor || '#b45309';
            const face = c.face || '$';

            this.ctx.save();
            this.ctx.translate(c.x, cy);

            // Outer glow + edge color
            this.ctx.shadowBlur = 20 + Math.sin(f * 0.15) * 8;
            this.ctx.shadowColor = coreColor;
            this.ctx.fillStyle = edgeColor;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, c.r * Math.max(widthScale, 0.15), c.r, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Inner core
            this.ctx.fillStyle = coreColor;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, c.r * 0.78 * Math.max(widthScale, 0.12), c.r * 0.78, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Highlight sheen
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            this.ctx.beginPath();
            this.ctx.ellipse(-c.r * 0.25, -c.r * 0.3, c.r * 0.28 * Math.max(widthScale, 0.15), c.r * 0.28, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Face — hide when coin is nearly edge-on
            if (widthScale > 0.35) {
                const fontSize = Math.floor(c.r * 0.9 * widthScale);
                this.ctx.fillStyle = edgeColor;
                this.ctx.font = `900 ${fontSize}px 'Outfit', sans-serif`;
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(face, 0, 1);
            }

            this.ctx.restore();
        });
    }

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
            this.ctx.fillStyle = b.tint || "#fff";
            this.ctx.shadowBlur = 25;
            this.ctx.shadowColor = b.tint || "#ec4899";
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

        if (this.state.shieldActive) {
            const shieldPulse = Math.sin(this.state.frameCount * 0.15) * 0.2 + 0.8;
            const shieldR = (this.player.w / 2) * 1.4;
            this.ctx.save();
            this.ctx.globalAlpha = 0.5 * shieldPulse;
            this.ctx.shadowBlur = 30;
            this.ctx.shadowColor = "#3b82f6";
            this.ctx.strokeStyle = "#60a5fa";
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, shieldR, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 0.15 * shieldPulse;
            this.ctx.fillStyle = "#3b82f6";
            this.ctx.fill();
            this.ctx.restore();
        }

        const trailDef = this.config.shopTrails.find(t => t.id === this.state.selectedTrail);
        if (trailDef && trailDef.color && this.state.gameRunning) {
            if (Math.floor(this.state.frameCount) % 2 === 0) {
                this.state.particles.push({
                    x: cx - this.player.w * 0.3 + (Math.random() - 0.5) * 20,
                    y: cy + (Math.random() - 0.5) * this.player.h * 0.4,
                    vx: -(Math.random() * 2 + 1),
                    vy: (Math.random() - 0.5) * 1.5,
                    size: Math.random() * 4 + 2,
                    color: trailDef.color,
                    life: 0.7,
                    isMega: true,
                    isTrail: true
                });
            }
        }

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

            // Spawn occasional ember particles at high combo (throttled on mobile)
            const emberGate = this.perfMode ? 10 : 4;
            if (combo >= 6 && Math.floor(this.state.frameCount) % emberGate === 0) {
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

        const selected = this.config.shopColors.find(c => c.id === this.state.selectedColor);

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.player.velocity * this.config.birdRotationFactor)) + this.player.flipAngle);
        this.ctx.scale(-1, 1);

        if (selected && selected.tint) {
            // Composite the tinted bird on an offscreen canvas so destination-in
            // stays isolated from the main canvas (otherwise it wipes the whole screen).
            // Use 'color' blend instead of 'multiply' — preserves luminosity while applying hue.
            if (!this._tintCanvas) {
                this._tintCanvas = document.createElement('canvas');
                this._tintCanvas.width = this.player.w;
                this._tintCanvas.height = this.player.h;
                this._tintCtx = this._tintCanvas.getContext('2d');
            }
            const tc = this._tintCtx;
            tc.globalCompositeOperation = 'source-over';
            tc.clearRect(0, 0, this.player.w, this.player.h);
            tc.drawImage(this.assets.player, 0, 0, this.player.w, this.player.h);
            tc.globalCompositeOperation = 'color';
            tc.fillStyle = selected.tint;
            tc.fillRect(0, 0, this.player.w, this.player.h);
            tc.globalCompositeOperation = 'destination-in';
            tc.drawImage(this.assets.player, 0, 0, this.player.w, this.player.h);

            this.ctx.drawImage(this._tintCanvas, -this.player.w / 2, -this.player.h / 2, this.player.w, this.player.h);
        } else {
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
            this.ctx.fillText(`+${this.state.lastCoinsEarned} AD COINS 💰   (TOTAL: ${this.state.adCoins})`, this.canvas.width / 2, this.canvas.height / 2 + 158);
            this.ctx.restore();
        }

        // Paid ads destroyed meter
        if (this.state.paidAdsDestroyed > 0) {
            const adT = Math.max(0, t - 60);
            const adProgress = ease(adT, 20);
            if (adProgress > 0) {
                this.ctx.save();
                this.ctx.globalAlpha = adProgress;
                this.ctx.font = "bold 16px 'Outfit', sans-serif";
                this.ctx.fillStyle = "#ec4899";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.shadowBlur = 12;
                this.ctx.shadowColor = "#ec4899";
                this.ctx.fillText(`💥 ${this.state.paidAdsDestroyed} REAL BRANDS DESTROYED`, this.canvas.width / 2, this.canvas.height / 2 + 188);
                this.ctx.restore();
            }
        }

        // RUN IT BACK button with entrance animation
        const btnT = Math.max(0, t - 70);
        const btnProgress = ease(btnT, 20);
        
        if (btnProgress > 0) {
            const btnW = 280;
            const btnH = 64;
            const btnX = (this.canvas.width - btnW) / 2;
            const btnYBase = this.canvas.height / 2 + 220 + ((1 - btnProgress) * 20);
            const btnRadius = 14;
            
            // Hover lift
            const hoverLift = (this.state.runItBackHover || this.state.gameOverFocus === 0) ? 4 : 0;
            const btnY = btnYBase - hoverLift;
            
            // Click compression — button briefly squishes down and fades out on click
            const framesSincePress = this.state.runItBackPressed ? this.state.frameCount - this.state.runItBackPressed : 999;
            const clickScale = framesSincePress < 10 ? 1 - (0.15 * (1 - framesSincePress / 10)) : 1;
            const clickAlpha = framesSincePress < 20 ? Math.max(0, 1 - (framesSincePress / 20)) : 1;
            
            // Pulse
            const pulse = Math.sin(this.state.frameCount * 0.06) * 0.5 + 0.5;
            const baseGlow = 20 + (pulse * 20);
            const hoverGlow = (this.state.runItBackHover || this.state.gameOverFocus === 0) ? 20 : 0;
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
            const runFocused = this.state.runItBackHover || this.state.gameOverFocus === 0;
            this.ctx.strokeStyle = runFocused ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.4)";
            this.ctx.lineWidth = runFocused ? 3 : 2;
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

            // Focus ring for keyboard focus on game over SHOP button
            if (this.state.gameOverFocus === 1) {
                this.ctx.save();
                this.ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.roundRect(shopBtnX - 5, shopBtnY - 5, shopBtnW + 10, shopBtnH + 10, 14);
                this.ctx.stroke();
                this.ctx.restore();
            }

            this.ctx.save();
            this.ctx.globalAlpha = btnProgress;
            this._renderShopButton(this._gameOverShopBtnRect);
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
        this.ctx.translate(cx, cy + 110);
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
        
        const cardW = 240;
        const cardH = 130;
        const cardGap = 24;
        const totalW = (cardW * 2) + cardGap;
        const startX = cx - totalW / 2;
        const instY = cy - 85;
        
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
            this.ctx.font = "44px serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(ins.icon, iX + cardW / 2, instY + 40 + iconBob);

            // Label
            this.ctx.font = "900 24px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fff";
            this.ctx.shadowBlur = 8 + borderPulse * 8;
            this.ctx.shadowColor = accent;
            this.ctx.fillText(ins.label, iX + cardW / 2, instY + 85);
            this.ctx.shadowBlur = 0;

            // Description
            this.ctx.font = "bold 12px 'Outfit', sans-serif";
            this.ctx.fillStyle = accent;
            this.ctx.fillText(ins.desc, iX + cardW / 2, instY + 110);

            this.ctx.restore();
        });
        
        // --- HIGH SCORE BADGES — triangle: 1 on top (BEST REACH), 2 below flanking (IMPACT, MISSES) ---
        if (this.state.highScore > 0 || this.state.highDirectHits > 0) {
            const bW = 210;
            const bH = 70;
            const bGap = 20;
            const topY = 150;
            const bottomY = topY + bH + 10;
            
            const badges = [
                { label: "BEST REACH", val: this.state.highScore, color: "#fbbf24", x: cx - bW / 2, y: topY },
                { label: "BEST IMPACT", val: this.state.highDirectHits, color: "#06b6d4", x: cx - bW - bGap / 2, y: bottomY },
                { label: "BEST MISSES", val: this.state.highTotalMisses, color: "#f43f5e", x: cx + bGap / 2, y: bottomY }
            ];
            
            badges.forEach(b => {
                this.ctx.save();
                this.ctx.globalAlpha = 0.9;
                
                this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
                this.ctx.beginPath();
                this.ctx.roundRect(b.x, b.y, bW, bH, 14);
                this.ctx.fill();
                
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = b.color;
                this.ctx.strokeStyle = b.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.roundRect(b.x, b.y, bW, bH, 14);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
                
                this.ctx.font = "bold 12px 'Outfit', sans-serif";
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "top";
                this.ctx.fillText(b.label, b.x + bW / 2, b.y + 10);
                this.ctx.font = "900 34px 'Outfit', sans-serif";
                this.ctx.fillStyle = b.color;
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(b.val, b.x + bW / 2, b.y + 46);
                
                this.ctx.restore();
            });
        }

        // Streak badge — top center, where main score sits during gameplay
        if (this.state.currentStreak > 0 || this.state.highStreak > 0) {
            const sBw = 260;
            const sBh = 50;
            const sBx = cx - sBw / 2;
            const sBy = 45;
            this.ctx.save();
            this.ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
            this.ctx.beginPath();
            this.ctx.roundRect(sBx, sBy, sBw, sBh, 14);
            this.ctx.fill();
            this.ctx.shadowBlur = 12 + Math.sin(f * 0.08) * 6;
            this.ctx.shadowColor = "#a855f7";
            this.ctx.strokeStyle = "#a855f7";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(sBx, sBy, sBw, sBh, 14);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            this.ctx.font = "bold 11px 'Outfit', sans-serif";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText("🔥  STREAK", sBx + sBw / 2, sBy + 12);
            this.ctx.font = "900 22px 'Outfit', sans-serif";
            this.ctx.fillStyle = "#fff";
            this.ctx.fillText(`${this.state.currentStreak}  •  BEST ${this.state.highStreak}`, sBx + sBw / 2, sBy + 33);
            this.ctx.restore();
        }
        
        // --- SPLASH LAYOUT ---
        this._recalculateSplashRects();

        // --- PLAY BUTTON ---
        const play = this._playBtnRect;
        const ctaText = this.isMobile ? "▶ TAP TO PLAY" : "▶ PRESS ENTER TO PLAY";
        const playPressProgress = this._getPressProgress(this.state.playBtnPressed);
        const playIsPressed = this.state.playBtnPressed && (Date.now() - this.state.playBtnPressed) < 500;
        const playClickScale = playIsPressed ? (0.8 + playPressProgress * 0.2) : 1.0;
        const playClickAlpha = playIsPressed ? playPressProgress : 1.0;

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
        
        // Click compression for rent button.
        // Clamp alpha floor to 1.0 if the button isn't actively being pressed — protects against
        // stale rentBtnPressed timestamps (e.g. user returned from Stripe tab after >330ms).
        const rentPressProgress = this._getPressProgress(this.state.rentBtnPressed);
        const rentIsPressed = this.state.rentBtnPressed && (Date.now() - this.state.rentBtnPressed) < 500;
        const rentClickScale = rentIsPressed ? (0.8 + rentPressProgress * 0.2) : 1.0;
        const rentClickAlpha = rentIsPressed ? rentPressProgress : 1.0;
        
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
        
        // --- SHOP BUTTON (shown on all devices) ---
        if (this._shopBtnRect) this._renderShopButton(this._shopBtnRect);

        // --- SHOP MODAL (renders on top of everything if open) ---
        if (this.state.shopOpen) this._renderShop();

        // --- KEYBOARD HINT (desktop only) — below the shop button ---
        if (!this.isMobile) {
            const hintText = "← → ARROWS TO SELECT  •  ENTER TO ACTIVATE";
            this.ctx.save();
            this.ctx.font = "bold 12px 'Outfit', sans-serif";
            const hintW = this.ctx.measureText(hintText).width + 28;
            const hintH = 24;
            const hintX = cx - hintW / 2;
            const hintY = this._shopBtnRect.y + this._shopBtnRect.h + 22;

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
        this.state.gameOverFocus = 0;
        this.state.shopOpen = false;
        this.state.shopHoverIndex = -1;
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
        this.coins = [];
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
        const cy = this.canvas.height / 2 + 220 + btnH / 2;
        
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
    _setupHiDPI() {
        const dpr = window.devicePixelRatio || 1;
        if (dpr > 1) {
            const lw = this.canvas.width;
            const lh = this.canvas.height;
            this.canvas.width = lw * dpr;
            this.canvas.height = lh * dpr;
            this.ctx.scale(dpr, dpr);
            // NOTE: Locks canvas.width/height to logical size for DPR scaling.
            Object.defineProperty(this.canvas, 'width', { get: () => lw, configurable: true });
            Object.defineProperty(this.canvas, 'height', { get: () => lh, configurable: true });
        }
        this.canvas.style.touchAction = 'none';
        this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        // perfMode auto-on for mobile — reduces particle count and expensive shadowBlur
        this.perfMode = this.isMobile;
    }
    _renderOverlay() { 
        this._renderHUD(); 
        if (this.state.isGameOver) this._renderGameOverScreen(); 
        else if (!this.state.gameRunning && !this.state.waitingForGameOver) this._renderStartScreen(); 
    }
    _initMidground() {
        this.bubbles = [];
        const bubbleCount = this.perfMode ? 8 : 15;
        const orbCount = this.perfMode ? 4 : 8;
        const dustCount = this.perfMode ? 3 : 6;

        for (let i = 0; i < bubbleCount; i++) {
            this.bubbles.push({
                type: 'bubble',
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2.5 + 1,
                speed: Math.random() * 1.5 + 0.8,
                alpha: Math.random() * 0.4 + 0.2,
                bobPhase: Math.random() * Math.PI * 2,
                bobSpeed: 0.03 + Math.random() * 0.04
            });
        }

        const colors = ["#a855f7", "#06b6d4", "#ec4899"];
        for (let i = 0; i < orbCount; i++) {
            this.bubbles.push({
                type: 'orb',
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 8 + 4,
                speed: Math.random() * 0.5 + 0.3,
                color: colors[i % colors.length],
                alpha: 0.35 + Math.random() * 0.25,
                bobPhase: Math.random() * Math.PI * 2,
                bobSpeed: 0.015 + Math.random() * 0.025
            });
        }

        for (let i = 0; i < dustCount; i++) {
            this.bubbles.push({
                type: 'dust',
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 20 + 15,
                speed: Math.random() * 0.2 + 0.1,
                alpha: 0.12 + Math.random() * 0.1,
                bobPhase: Math.random() * Math.PI * 2,
                bobSpeed: 0.008 + Math.random() * 0.015
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
                // Glowy neon orbs — shadowBlur skipped in perfMode (huge mobile cost)
                if (!this.perfMode) {
                    this.ctx.shadowBlur = 12;
                    this.ctx.shadowColor = b.color;
                }
                this.ctx.fillStyle = b.color;
                this.ctx.beginPath();
                this.ctx.arc(b.x, drawY, b.size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (b.type === 'dust') {
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                if (!this.perfMode) {
                    this.ctx.shadowBlur = b.size * 1.2;
                    this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
                }
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

        // PLAY — moved up since cards are now above
        const ctaText = this.isMobile ? "▶ TAP TO PLAY" : "▶ PRESS ENTER TO PLAY";
        this.ctx.save();
        this.ctx.font = "900 24px 'Outfit', sans-serif";
        const ctaW = this.ctx.measureText(ctaText).width + 60;
        const ctaH = 52;
        const ctaX = cx - ctaW / 2;
        const ctaBaseY = cy + 200;
        const playHoverLift = this.state.playBtnHover ? 4 : 0;
        const ctaY = ctaBaseY - playHoverLift;
        this._playBtnRect = { x: ctaX, y: ctaY - ctaH / 2, w: ctaW, h: ctaH };
        this.ctx.restore();

        // RENT — tightened spacing
        const rentBtnW = 260;
        const rentBtnH = 54;
        const rentX = cx - rentBtnW / 2;
        const rentBaseY = ctaBaseY + 48;
        const rentHoverLift = this.state.rentBtnHover ? 4 : 0;
        const rentY = rentBaseY - rentHoverLift;
        this._rentBtnRect = { x: rentX, y: rentY, w: rentBtnW, h: rentBtnH };

        // SHOP — anchors to rentBaseY (not rent's possibly-lifted y)
        // so hovering the rent button doesn't drag the shop up/down
        const shopBtnW = 200;
        const shopBtnH = 36;
        const shopX = cx - shopBtnW / 2;
        const shopY = rentBaseY + rentBtnH + 22;
        this._shopBtnRect = { x: shopX, y: shopY, w: shopBtnW, h: shopBtnH };
    }

    _pushFloatingText(cfg) {
        // Auto-adjusts y upward to avoid overlapping existing nearby floating texts.
        // Bumps up by 50px at a time until the slot is clear (max 8 bumps).
        let y = cfg.y;
        let attempts = 0;
        let overlapping = true;
        while (overlapping && attempts < 8) {
            overlapping = false;
            for (const t of this.floatingTexts) {
                if (Math.abs(t.x - cfg.x) < 150 && Math.abs(t.y - y) < 45) {
                    y -= 50;
                    overlapping = true;
                    attempts++;
                    break;
                }
            }
        }
        this.floatingTexts.push({
            age: 0,
            alpha: 1,
            vx: 0,
            vy: 0,
            align: 'center',
            ...cfg,
            y: y
        });
    }

    _hexToRgb(hex) {
        const m = (hex || "").match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (!m) return "255, 255, 255";
        return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
    }

    _getShopItems() {
        switch (this.state.shopTab) {
            case 'trails': return this.config.shopTrails;
            case 'bombs': return this.config.shopBombs;
            case 'pipes': return this.config.shopPipes;
            case 'magnets': return this.config.shopMagnets;
            case 'birds':
            default: return this.config.shopColors;
        }
    }

    _getOwnershipState(item) {
        switch (this.state.shopTab) {
            case 'trails':
                return { owned: this.state.ownedTrails.includes(item.id), selected: this.state.selectedTrail === item.id };
            case 'bombs':
                return { owned: this.state.ownedBombs.includes(item.id), selected: this.state.selectedBomb === item.id };
            case 'pipes':
                return { owned: this.state.ownedPipes.includes(item.id), selected: this.state.selectedPipe === item.id };
            case 'magnets':
                return { owned: this.state.ownedMagnets.includes(item.id), selected: this.state.selectedMagnet === item.id };
            case 'birds':
            default:
                return { owned: this.state.ownedColors.includes(item.id), selected: this.state.selectedColor === item.id };
        }
    }

    _applyShopPurchase(item) {
        const cost = item.cost;
        const id = item.id;
        const tab = this.state.shopTab;
        const ownedMap = {
            birds: { arr: 'ownedColors', key: 'adBirdOwnedColors', sel: 'selectedColor', selKey: 'adBirdSelectedColor' },
            trails: { arr: 'ownedTrails', key: 'adBirdOwnedTrails', sel: 'selectedTrail', selKey: 'adBirdSelectedTrail' },
            bombs: { arr: 'ownedBombs', key: 'adBirdOwnedBombs', sel: 'selectedBomb', selKey: 'adBirdSelectedBomb' },
            pipes: { arr: 'ownedPipes', key: 'adBirdOwnedPipes', sel: 'selectedPipe', selKey: 'adBirdSelectedPipe' },
            magnets: { arr: 'ownedMagnets', key: 'adBirdOwnedMagnets', sel: 'selectedMagnet', selKey: 'adBirdSelectedMagnet' }
        };
        const m = ownedMap[tab];
        if (!m) return false;
        const isOwned = this.state[m.arr].includes(id);
        if (isOwned) {
            this.state[m.sel] = id;
            this._safeStorage('set', m.selKey, id);
            this.playSound('score');
            return true;
        }
        if (this.state.adCoins >= cost) {
            this.state.adCoins -= cost;
            this.state[m.arr].push(id);
            this.state[m.sel] = id;
            this._safeStorage('set', 'adBirdCoins', this.state.adCoins);
            this._safeStorage('set', m.key, JSON.stringify(this.state[m.arr]));
            this._safeStorage('set', m.selKey, id);
            this.playSound('shift');
            return true;
        }
        return false;
    }

    _renderShopButton(rect) {
        const hover = this.state.mouseX >= rect.x && this.state.mouseX <= rect.x + rect.w &&
                      this.state.mouseY >= rect.y && this.state.mouseY <= rect.y + rect.h;
        // Only treat as "focused for highlight" if this is the splash screen shop AND focus is 2
        const focused = !this.state.gameRunning && !this.state.isGameOver && this.state.splashFocus === 2 &&
                        rect === this._shopBtnRect;
        const active = hover || focused;
        const pulse = Math.sin(this.state.frameCount * 0.08) * 0.5 + 0.5;
        const hoverScale = active ? 1.08 : 1.0;
        const hoverLift = active ? 3 : 0;
        const glowIntensity = active ? 25 + pulse * 10 : 12 + pulse * 5;

        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;

        this.ctx.save();
        // Hover/Focus lift + scale-about-center
        this.ctx.translate(0, -hoverLift);
        this.ctx.translate(cx, cy);
        this.ctx.scale(hoverScale, hoverScale);
        this.ctx.translate(-cx, -cy);

        // Fill
        this.ctx.fillStyle = active ? "rgba(251, 191, 36, 0.3)" : "rgba(251, 191, 36, 0.15)";
        this.ctx.beginPath();
        this.ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
        this.ctx.fill();

        // Glowing border
        this.ctx.strokeStyle = "#fbbf24";
        this.ctx.lineWidth = active ? 3 : 2;
        this.ctx.shadowBlur = glowIntensity;
        this.ctx.shadowColor = "#fbbf24";
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Shimmer sweep on active
        if (active) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
            this.ctx.clip();
            const sPos = (this.state.frameCount * 0.02) % 1;
            const sW = 50;
            const sX = rect.x - sW + (rect.w + sW * 2) * sPos;
            const sGrad = this.ctx.createLinearGradient(sX, 0, sX + sW, 0);
            sGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
            sGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.45)");
            sGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
            this.ctx.fillStyle = sGrad;
            this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            this.ctx.restore();
        }

        // Text
        this.ctx.font = "900 18px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(`💰 SHOP  •  ${this.state.adCoins}`, cx, cy);

        // Focus ring when keyboard-selected
        if (focused) {
            this.ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(rect.x - 5, rect.y - 5, rect.w + 10, rect.h + 10, 14);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    _renderShop() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const w = Math.min(this.canvas.width * 0.78, 680);
        const h = 620;
        const x = cx - w / 2;
        const y = cy - h / 2;
        const f = this.state.frameCount;

        this.ctx.save();

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

        const borderGlow = 18 + Math.sin(f * 0.05) * 8;
        this.ctx.strokeStyle = "#a855f7";
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = borderGlow;
        this.ctx.shadowColor = "#a855f7";
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 24);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        const titleY = y + 45;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        // CLOSE BUTTON — top right corner
        const closeR = 22;
        const closeCX = x + w - 30;
        const closeCY = y + 30;
        this._shopCloseBtnRect = { cx: closeCX, cy: closeCY, r: closeR };
        const closeHover = Math.hypot(this.state.mouseX - closeCX, this.state.mouseY - closeCY) < closeR + 4 || this.state.shopHoverIndex === -2;
        const closeScale = closeHover ? 1.15 : 1.0;
        const closePulse = closeHover ? (Math.sin(f * 0.15) * 0.15 + 0.85) : 1.0;
        this.ctx.save();
        this.ctx.translate(closeCX, closeCY);
        this.ctx.scale(closeScale, closeScale);
        this.ctx.fillStyle = closeHover ? "rgba(244, 63, 94, 0.35)" : "rgba(255, 255, 255, 0.08)";
        this.ctx.beginPath();
        this.ctx.arc(0, 0, closeR, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = closeHover ? "#f43f5e" : "rgba(255, 255, 255, 0.4)";
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = closeHover ? 18 * closePulse : 0;
        this.ctx.shadowColor = "#f43f5e";
        this.ctx.beginPath();
        this.ctx.arc(0, 0, closeR, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        if (this.state.shopHoverIndex === -2) {
            this.ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, closeR + 7, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        this.ctx.strokeStyle = closeHover ? "#fff" : "rgba(255, 255, 255, 0.75)";
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = "round";
        const xOff = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(-xOff, -xOff);
        this.ctx.lineTo(xOff, xOff);
        this.ctx.moveTo(xOff, -xOff);
        this.ctx.lineTo(-xOff, xOff);
        this.ctx.stroke();
        this.ctx.restore();

        this.ctx.font = "900 32px 'Outfit', sans-serif";
        const titleText = "COSMETICS SHOP";
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 4;
        this.ctx.strokeText(titleText, cx, titleY);
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.shadowBlur = 16;
        this.ctx.shadowColor = "#f59e0b";
        this.ctx.fillText(titleText, cx, titleY);
        this.ctx.shadowBlur = 0;

        const coinPulse = 1 + Math.sin(f * 0.08) * 0.04;
        this.ctx.save();
        this.ctx.translate(cx, y + 75);
        this.ctx.scale(coinPulse, coinPulse);
        this.ctx.font = "bold 16px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "#fbbf24";
        this.ctx.fillText(`💰 ${this.state.adCoins} COINS`, 0, 0);
        this.ctx.restore();

        const tabs = [
            { id: 'birds', label: 'BIRDS' },
            { id: 'trails', label: 'TRAILS' },
            { id: 'bombs', label: 'BOMBS' },
            { id: 'pipes', label: 'PIPES' },
            { id: 'magnets', label: 'MAGNETS' }
        ];
        const tabY = y + 105;
        const tabH = 36;
        const tabGap = 8;
        const tabTotalW = w - 40;
        const tabW = (tabTotalW - tabGap * (tabs.length - 1)) / tabs.length;
        this._shopTabRects = [];
        tabs.forEach((t, i) => {
            const tx = x + 20 + i * (tabW + tabGap);
            const isActive = this.state.shopTab === t.id;
            this._shopTabRects.push({ x: tx, y: tabY, w: tabW, h: tabH, id: t.id });
            this.ctx.fillStyle = isActive ? "rgba(168, 85, 247, 0.3)" : "rgba(255, 255, 255, 0.04)";
            this.ctx.beginPath();
            this.ctx.roundRect(tx, tabY, tabW, tabH, 10);
            this.ctx.fill();
            if (isActive) {
                this.ctx.strokeStyle = "#a855f7";
                this.ctx.lineWidth = 2;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = "#a855f7";
                this.ctx.beginPath();
                this.ctx.roundRect(tx, tabY, tabW, tabH, 10);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
            }
            this.ctx.font = "900 12px 'Outfit', sans-serif";
            this.ctx.fillStyle = isActive ? "#fff" : "rgba(255, 255, 255, 0.5)";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(t.label, tx + tabW / 2, tabY + tabH / 2);
        });

        const items = this._getShopItems();
        const rowH = 54;
        const rowStartY = tabY + tabH + 20;
        const rowPad = 20;

        items.forEach((c, i) => {
            const rowY = rowStartY + i * rowH;
            const rowX = x + rowPad;
            const rowW = w - rowPad * 2;
            const { owned, selected } = this._getOwnershipState(c);
            const canAfford = this.state.adCoins >= c.cost;
            const isHover = this.state.shopHoverIndex === i;
            const rowPhase = f * 0.05 + i * 0.3;
            const accentHex = c.tint || c.color || "#ffffff";
            const accentRgb = this._hexToRgb(accentHex);

            let rowBgAlpha = 0.05;
            let rowXOffset = 0;
            if (selected) rowBgAlpha = 0.18 + Math.sin(rowPhase) * 0.04;
            else if (isHover) { rowBgAlpha = 0.14; rowXOffset = 8; }

            this.ctx.fillStyle = `rgba(${accentRgb}, ${rowBgAlpha})`;
            this.ctx.beginPath();
            this.ctx.roundRect(rowX + rowXOffset, rowY, rowW, rowH - 6, 12);
            this.ctx.fill();

            if (selected) {
                this.ctx.strokeStyle = accentHex;
                this.ctx.lineWidth = 2;
                this.ctx.shadowBlur = 12;
                this.ctx.shadowColor = accentHex;
                this.ctx.beginPath();
                this.ctx.roundRect(rowX + rowXOffset, rowY, rowW, rowH - 6, 12);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
            }

            const swatchX = rowX + 30 + rowXOffset;
            const swatchY = rowY + (rowH - 6) / 2;
            const swatchPulse = 1 + Math.sin(rowPhase) * 0.1;
            const swatchR = 12 * swatchPulse;
            this.ctx.fillStyle = accentHex;
            this.ctx.shadowBlur = 14 + (isHover ? 8 : 0);
            this.ctx.shadowColor = accentHex;
            this.ctx.beginPath();
            this.ctx.arc(swatchX, swatchY, swatchR, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            this.ctx.font = "bold 18px 'Outfit', sans-serif";
            this.ctx.fillStyle = (selected || isHover) ? "#fff" : "#9ca3af";
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(c.name, swatchX + 26, swatchY);

            this.ctx.textAlign = "right";
            const rightX = rowX + rowW - 18 + rowXOffset;
            if (selected) {
                this.ctx.font = "900 13px 'Outfit', sans-serif";
                this.ctx.fillStyle = "#10b981";
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = "#10b981";
                this.ctx.fillText("EQUIPPED", rightX, swatchY);
                this.ctx.shadowBlur = 0;
            } else if (owned) {
                this.ctx.font = "900 16px 'Outfit', sans-serif";
                this.ctx.fillStyle = isHover ? "#93c5fd" : "#3b82f6";
                this.ctx.fillText("SELECT →", rightX, swatchY);
            } else if (canAfford) {
                this.ctx.font = "900 16px 'Outfit', sans-serif";
                this.ctx.fillStyle = isHover ? "#fde047" : "#fbbf24";
                this.ctx.shadowBlur = isHover ? 14 : 8;
                this.ctx.shadowColor = "#fbbf24";
                this.ctx.fillText(`BUY 💰${c.cost}`, rightX, swatchY);
                this.ctx.shadowBlur = 0;
            } else {
                this.ctx.font = "900 16px 'Outfit', sans-serif";
                this.ctx.fillStyle = "#6b7280";
                this.ctx.fillText(`🔒 ${c.cost}`, rightX, swatchY);
            }
        });

        this.ctx.font = "bold 11px 'Outfit', sans-serif";
        this.ctx.fillStyle = "#6b7280";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("CLICK OUTSIDE OR SHOP BUTTON TO CLOSE  •  TAB/ARROWS TO NAVIGATE", cx, y + h - 22);

        this.ctx.restore();
    }

    _handleShopKey(e) {
        if (!this.state.shopOpen) return false;

        const isEnter = e.code === 'Enter' || e.key === 'Enter';
        const isEscape = e.code === 'Escape' || e.key === 'Escape';
        const isSpace = e.code === 'Space' || e.key === ' ';
        const isUp = ['ArrowUp', 'KeyW'].includes(e.code) || ['w', 'W'].includes(e.key);
        const isDown = ['ArrowDown', 'KeyS'].includes(e.code) || ['s', 'S'].includes(e.key);
        const isLeft = ['ArrowLeft', 'KeyA'].includes(e.code) || ['a', 'A'].includes(e.key);
        const isRight = ['ArrowRight', 'KeyD'].includes(e.code) || ['d', 'D'].includes(e.key);
        const isTab = e.code === 'Tab' || e.key === 'Tab';

        if (isEscape) {
            e.preventDefault();
            this.state.shopOpen = false;
            this.state.shopHoverIndex = -1;
            this.playSound('score');
            return true;
        }

        const tabs = ['birds', 'trails', 'bombs', 'pipes', 'magnets'];
        if (isTab || isLeft || isRight) {
            e.preventDefault();
            const currentIdx = tabs.indexOf(this.state.shopTab);
            const delta = (isRight || (isTab && !e.shiftKey)) ? 1 : -1;
            const newIdx = (currentIdx + delta + tabs.length) % tabs.length;
            this.state.shopTab = tabs[newIdx];
            this.state.shopHoverIndex = -1;
            this.playSound('score');
            return true;
        }

        if (isUp || isDown) {
            e.preventDefault();
            const items = this._getShopItems();
            const len = items.length;
            if (this.state.shopHoverIndex === -2) {
                // Close X focused — Down goes to item 0, Up wraps to last item
                this.state.shopHoverIndex = isDown ? 0 : len - 1;
            } else if (this.state.shopHoverIndex < 0) {
                const selectedId = this._getCurrentSelectedId();
                const idx = items.findIndex(c => c.id === selectedId);
                this.state.shopHoverIndex = idx >= 0 ? idx : 0;
            } else if (isUp && this.state.shopHoverIndex === 0) {
                // Up from item 0 focuses close X
                this.state.shopHoverIndex = -2;
            } else if (isDown && this.state.shopHoverIndex === len - 1) {
                // Down from last item focuses close X
                this.state.shopHoverIndex = -2;
            } else {
                const delta = isUp ? -1 : 1;
                this.state.shopHoverIndex = (this.state.shopHoverIndex + delta + len) % len;
            }
            this.playSound('score');
            return true;
        }

        if (isEnter || isSpace) {
            e.preventDefault();
            if (this.state.shopHoverIndex === -2) {
                this.state.shopOpen = false;
                this.state.shopHoverIndex = -1;
                this.playSound('score');
                return true;
            }
            const items = this._getShopItems();
            if (this.state.shopHoverIndex < 0) {
                const selectedId = this._getCurrentSelectedId();
                const idx = items.findIndex(c => c.id === selectedId);
                this.state.shopHoverIndex = idx >= 0 ? idx : 0;
                return true;
            }
            this._applyShopPurchase(items[this.state.shopHoverIndex]);
            return true;
        }

        e.preventDefault();
        return true;
    }

    _getCurrentSelectedId() {
        switch (this.state.shopTab) {
            case 'trails': return this.state.selectedTrail;
            case 'bombs': return this.state.selectedBomb;
            case 'pipes': return this.state.selectedPipe;
            case 'magnets': return this.state.selectedMagnet;
            default: return this.state.selectedColor;
        }
    }

    _handleShopClick(x, y) {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const w = Math.min(this.canvas.width * 0.78, 680);
        const h = 620;
        const modalX = cx - w / 2;
        const modalY = cy - h / 2;

        if (x < modalX || x > modalX + w || y < modalY || y > modalY + h) {
            this.state.shopOpen = false;
            return true;
        }

        if (this._shopCloseBtnRect) {
            const c = this._shopCloseBtnRect;
            if (Math.hypot(x - c.cx, y - c.cy) < c.r + 4) {
                this.state.shopOpen = false;
                this.state.shopHoverIndex = -1;
                this.playSound('score');
                return true;
            }
        }

        if (this._shopTabRects) {
            for (const tab of this._shopTabRects) {
                if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
                    if (this.state.shopTab !== tab.id) {
                        this.state.shopTab = tab.id;
                        this.state.shopHoverIndex = -1;
                        this.playSound('score');
                    }
                    return true;
                }
            }
        }

        const tabY = modalY + 105;
        const tabH = 36;
        const rowH = 54;
        const rowStartY = tabY + tabH + 20;
        const clickedRowIndex = Math.floor((y - rowStartY) / rowH);
        const items = this._getShopItems();
        if (clickedRowIndex >= 0 && clickedRowIndex < items.length) {
            this._applyShopPurchase(items[clickedRowIndex]);
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

    /* --- VIBE JAM PORTALS --- */

    _spawnPortal(isReturn = false) {
        const pW = 160;
        const pH = 160;
        this.portals.push({
            x: isReturn ? 150 : this.canvas.width + 100,
            y: this.canvas.height / 2 - pH / 2,
            w: pW,
            h: pH,
            isReturn: isReturn,
            angle: 0
        });
    }

    _renderPortals() {
        this.portals.forEach(pr => {
            this.ctx.save();
            this.ctx.translate(pr.x + pr.w / 2, pr.y + pr.h / 2);
            this.ctx.rotate(pr.angle);

            const col = pr.isReturn ? "#ec4899" : "#a855f7";
            const glow = pr.isReturn ? "#f43f5e" : "#3b82f6";

            // Portal Glow
            this.ctx.shadowBlur = 40;
            this.ctx.shadowColor = glow;
            this.ctx.globalAlpha = 0.6 + Math.sin(this.state.frameCount * 0.1) * 0.2;
            
            // Outer ring
            this.ctx.strokeStyle = col;
            this.ctx.lineWidth = 12;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, pr.w * 0.45, 0, Math.PI * 2);
            this.ctx.stroke();

            // Swirls
            this.ctx.shadowBlur = 20;
            for (let i = 0; i < 3; i++) {
                this.ctx.rotate(Math.PI * 2 / 3);
                this.ctx.beginPath();
                this.ctx.moveTo(pr.w * 0.2, 0);
                this.ctx.quadraticCurveTo(pr.w * 0.4, pr.h * 0.4, 0, pr.h * 0.3);
                this.ctx.stroke();
            }

            // Text
            this.ctx.rotate(-pr.angle); // Keep text upright
            this.ctx.textAlign = "center";
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "bold 16px 'Outfit', sans-serif";
            this.ctx.fillText(pr.isReturn ? "RETURN PORTAL" : "VIBE JAM PORTAL", 0, pr.h * 0.6);

            this.ctx.restore();
        });
    }

    _triggerPortalExit() {
        // Construct the Vibe Jam portal URL with player data
        const baseUrl = "https://vibejam.cc/portal/2026";
        const params = new URLSearchParams();
        params.set('username', this.state.portalData.username || 'Ad-Bird Player');
        params.set('color', this.state.selectedColor || '#3b82f6');
        params.set('speed', (3.0 + Math.floor(this.state.score / 10) * 0.25).toFixed(2));
        params.set('ref', window.location.origin + window.location.pathname);
        params.set('portal', 'true');
        
        window.location.href = `${baseUrl}?${params.toString()}`;
    }
}

