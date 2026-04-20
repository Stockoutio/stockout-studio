/**
 * Ad-Bird: Stockout Studio Arcade Engine
 * --------------------------------------
 * V1.6 - Hardened "Gallop-Proof" Edition
 * 
 * Performance: High (Layout Caching)
 * Latency: Zero (Low-Level Raw Inputs)
 * Platforms: Desktop (Mousedown) / Mobile (Touchstart)
 */

class AdBird {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.overlay = document.getElementById('gameOverlay');
        
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // HiDPI: match backing buffer to physical pixels so canvas text stays sharp on mobile
        const dpr = window.devicePixelRatio || 1;
        if (dpr > 1) {
            const lw = this.canvas.width;
            const lh = this.canvas.height;
            this.canvas.width = lw * dpr;
            this.canvas.height = lh * dpr;
            this.ctx.scale(dpr, dpr);
            Object.defineProperty(this.canvas, 'width', { get: () => lw, configurable: true });
            Object.defineProperty(this.canvas, 'height', { get: () => lh, configurable: true });
        }

        // Platform profile
        this.canvas.style.touchAction = 'none';
        this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        this.config = {
            gravity: options.gravity || 0.5,
            lift: options.lift || -8,
            pipeWidth: options.pipeWidth || 80,
            pipeGap: options.pipeGap || 230,
            pipeSpeed: options.pipeSpeed || 2.2,
            bgSpeed: options.bgSpeed || 0.5,
            bubbleCount: options.bubbleCount || 20,
            worldShiftInterval: options.worldShiftInterval || 10,
            bombCooldown: options.bombCooldown || 20,
            playerImg: options.playerImg || 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png',
            musicSrc: options.musicSrc || 'bg-music.mp3',
            worlds: options.worlds || ['world1.jpg', 'world2.jpg', 'world3.jpg'],
            ads: options.ads || [
                // Placeholder / Meta
                { text: "YOUR AD HERE", color: "#4ade80" }, { text: "BUY THIS PIPE", color: "#f59e0b" },
                { text: "RENT ME $5", color: "#06b6d4" }, { text: "SPONSORED", color: "#a855f7" },
                { text: "AD SLOT OPEN", color: "#4ade80" }, { text: "SEO LIVES HERE", color: "#94a3b8" },
                { text: "CPC: $0.04", color: "#22c55e" }, { text: "IMPRESSIONS++", color: "#ec4899" },
                { text: "SPOT VACANT", color: "#f8fafc" },
                // Fake Brands
                { text: "BIG PIPE CO", color: "#4ade80" }, { text: "PIPES.IO", color: "#06b6d4" },
                { text: "FLAP & CO", color: "#f59e0b" }, { text: "PIPE DEPOT", color: "#a855f7" },
                { text: "DUCTMART", color: "#4ade80" }, { text: "TUBE & SON", color: "#06b6d4" },
                // Startup Parody
                { text: "WE'RE HIRING", color: "#22c55e" }, { text: "PIPES AS A SERVICE", color: "#06b6d4" },
                { text: "SERIES A PIPE", color: "#f59e0b" }, { text: "DISRUPT PIPES", color: "#a855f7" },
                { text: "GO PUBLIC SOON", color: "#ec4899" }, { text: "PIPE TO THE MOON", color: "#4ade80" },
                { text: "WEB3 PIPE", color: "#06b6d4" },
                // Self-aware
                { text: "DON'T BOMB ME", color: "#f43f5e" }, { text: "PLEASE NO", color: "#f43f5e" },
                { text: "AVOID THIS PIPE", color: "#f59e0b" }, { text: "NOT A BILLBOARD", color: "#94a3b8" },
                { text: "DUCK!", color: "#f59e0b" }, { text: "INCOMING", color: "#f43f5e" },
                { text: "OUCH", color: "#f43f5e" }, { text: "RIP THIS PIPE", color: "#94a3b8" },
                { text: "I HAVE A FAMILY", color: "#ec4899" },
                // Crypto / Finance
                { text: "BUY BITCOIN", color: "#f59e0b" }, { text: "HODL", color: "#f59e0b" },
                { text: "DIAMOND PIPES", color: "#06b6d4" }, { text: "PIPE ETF", color: "#4ade80" },
                { text: "SHORT THE BIRD", color: "#f43f5e" }, { text: "LONG ON GUANO", color: "#22c55e" },
                { text: "ROTH IRAPIPE", color: "#a855f7" },
                // Wordplay
                { text: "PIPE DREAMS", color: "#06b6d4" }, { text: "PIPELINE FULL", color: "#a855f7" },
                { text: "PIPE ME UP", color: "#4ade80" }, { text: "DOWN THE PIPE", color: "#f59e0b" },
                { text: "PIPE IT UP", color: "#ec4899" }, { text: "HOT PIPE", color: "#f43f5e" },
                { text: "DRAIN PIPE 9", color: "#06b6d4" }, { text: "CLOG FREE", color: "#22c55e" },
                // Bird Burns
                { text: "FLY AWAY BIRD", color: "#94a3b8" }, { text: "NEST ELSEWHERE", color: "#94a3b8" },
                { text: "BIRD-PROOF", color: "#f43f5e" }, { text: "ANTI-BIRD", color: "#f43f5e" },
                { text: "NO BIRDS ALLOWED", color: "#f43f5e" }, { text: "BEAK OFF", color: "#a855f7" },
                { text: "BIRD REPELLENT", color: "#22c55e" }, { text: "TALON-TESTED", color: "#06b6d4" },
                // Random Absurd
                { text: "EGGS ON SALE", color: "#f59e0b" }, { text: "FREE WI-FI", color: "#4ade80" },
                { text: "CALL YOUR MOM", color: "#ec4899" }, { text: "MISS YOU MOM", color: "#ec4899" },
                { text: "HI MOM", color: "#ec4899" }, { text: "THIS IS FINE", color: "#f59e0b" },
                { text: "LIVE LAUGH LOVE", color: "#ec4899" }, { text: "NAMASTE", color: "#06b6d4" },
                { text: "TOUCH GRASS", color: "#22c55e" },
                // Fake URLs
                { text: "VISIT MY SITE", color: "#06b6d4" }, { text: "DM FOR RATES", color: "#a855f7" },
                { text: "LINK IN BEAK", color: "#4ade80" }, { text: "1-800-PIPE", color: "#f59e0b" },
                { text: "PIPE.LY/BUY", color: "#06b6d4" }, { text: "CLICK HERE", color: "#22c55e" },
                { text: "SCAN QR CODE", color: "#a855f7" }, { text: "TAP TO CALL", color: "#4ade80" },
                // Existential
                { text: "WHY AM I HERE", color: "#94a3b8" }, { text: "WHAT IS PIPE", color: "#94a3b8" },
                { text: "AM I REAL", color: "#94a3b8" }, { text: "HELP", color: "#f43f5e" },
                { text: "I SEE YOU", color: "#ec4899" }, { text: "GOODBYE WORLD", color: "#94a3b8" },
                { text: "SEND HELP", color: "#f43f5e" }, { text: "THE END IS PIPE", color: "#a855f7" }
            ],
            hitMessages: [
                "WASTED", "REKT", "STAINED", "SPLAT", "GET REKT", "BILLBOARDED", 
                "SIGN SMASHED", "MESSY", "BULLSEYE", "AD-BLASTED", "INKED", 
                "VANDALIZED", "SCORE!", "BIRDPOCALYPSE", "BEAK-TACULAR", 
                "EGG-STERMINATION", "UN-BEAK-ABLE", "FLAPPING SPREE", 
                "WING-SLAUGHTER", "FEATHER-KILL", "DOUBLE BILL", 
                "TRIPLE TWEET", "OVER-FLAP", "BILL-IONAIRE"
            ],
            msgColors: ["#a855f7", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899"]
        };

        // HUD Geometry (Modular UI)
        this.ui = {
            fullscreenBtn: { x: this.canvas.width - 35, y: this.canvas.height - 35, radius: 30, buffer: 25 },
            bombBtn: { x: 15, y: this.canvas.height - 85, w: 110, h: 70, radius: 12, buffer: 20 },
            muteBtn: { x: this.canvas.width - 20, y: 50, buffer: 60 },
            scoreCenter: this.canvas.width / 2
        };

        this.state = {
            gameRunning: false,
            score: 0,
            directHits: 0,
            highScore: parseInt(localStorage.getItem('adBirdHighScore')) || 0,
            highDirectHits: parseInt(localStorage.getItem('adBirdHighDirectHits')) || 0,
            frameCount: 0,
            nextPipeFrame: 40,
            currentWorld: 0,
            flashOpacity: 0,
            isMuted: false,
            bgX: 0,
            screenShake: 0,
            bombTimer: 0,
            isFullscreen: false,
            assetsLoaded: 0,
            lastRect: null
        };

        this.player = {
            x: 250, y: 150, w: 70, h: 70,
            velocity: 0, flipAngle: 0, isFlipping: false,
            flipSpeed: 0.25, flipDirection: 1
        };

        this.pipes = [];
        this.bombs = [];
        this.bubbles = [];
        this.floatingTexts = [];
        this.assets = {
            player: new Image(),
            worlds: [],
            music: new Audio(this.config.musicSrc)
        };
        this.assets.music.loop = true;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        this._init();
    }

    _init() {
        // Asset Loading
        this.assets.player.src = this.config.playerImg;
        this.assets.player.onload = () => this.state.assetsLoaded++;

        this.config.worlds.forEach((path) => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                this.state.assetsLoaded++;
                if (!this.state.gameRunning) this.drawStartScreen();
            };
            this.assets.worlds.push(img);
        });

        // Event Registration (Arcade-Perfect Raw Layers)
        window.addEventListener('keydown', (e) => this._handleKeydown(e));
        
        const inputTarget = this.canvas.parentElement || this.canvas;
        
        // Desktop Raw Input
        inputTarget.addEventListener('mousedown', (e) => {
            if (this.isMobile) return; 
            this._handleInput(e);
        });

        // Mobile Raw Input
        inputTarget.addEventListener('touchstart', (e) => {
            if (!this.isMobile) return;
            const touch = e.touches[0];
            this._handleInput({ 
                clientX: touch.clientX, 
                clientY: touch.clientY, 
                button: 0,
                preventDefault: () => e.preventDefault()
            });
        }, { passive: false });

        inputTarget.addEventListener('contextmenu', (e) => e.preventDefault());
        
        if (this.overlay) {
            this.overlay.addEventListener('mousedown', () => this.start());
            this.overlay.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.start();
            });
        }

        const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        fsEvents.forEach(evt => {
            document.addEventListener(evt, () => {
                this.state.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            });
        });

        this._initBubbles();
        requestAnimationFrame(() => this.drawStartScreen());
    }

    _initBubbles() {
        this.bubbles = Array.from({ length: this.config.bubbleCount }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 1 + 1
        }));
    }

    _getCanvasCoords(e) {
        const rect = this.state.lastRect || this.canvas.getBoundingClientRect();
        const canvasRatio = this.canvas.width / this.canvas.height;
        const screenRatio = rect.width / rect.height;
        let dw, dh, dx, dy;

        if (screenRatio > canvasRatio) {
            dh = rect.height;
            dw = dh * canvasRatio;
            dx = (rect.width - dw) / 2;
            dy = 0;
        } else {
            dw = rect.width;
            dh = dw / canvasRatio;
            dx = 0;
            dy = (rect.height - dh) / 2;
        }

        return {
            x: Math.max(0, Math.min(this.canvas.width, (e.clientX - (rect.left + dx)) * (this.canvas.width / dw))),
            y: Math.max(0, Math.min(this.canvas.height, (e.clientY - (rect.top + dy)) * (this.canvas.height / dh)))
        };
    }

    _handleKeydown(e) {
        const flapKeys = ['Space', 'ArrowUp', 'KeyW', 'KeyK'];
        const bombKeys = ['ShiftLeft', 'ShiftRight', 'ArrowDown', 'KeyS', 'KeyJ'];
        if (flapKeys.includes(e.code)) {
            e.preventDefault();
            if (!this.state.gameRunning) this.start();
            else this.flap();
        } else if (bombKeys.includes(e.code)) {
            e.preventDefault();
            if (!this.state.gameRunning) this.start();
            else this.dropBomb();
        } else if (e.code === 'KeyF') {
            this.toggleFullscreen();
        }
    }

    _handleInput(e) {
        const { x, y } = this._getCanvasCoords(e);
        
        // 1. HUD Checks
        const fs = this.ui.fullscreenBtn;
        if (Math.hypot(x - fs.x, y - fs.y) < fs.radius + fs.buffer) {
            this.toggleFullscreen();
            return;
        }
        if (x > this.ui.muteBtn.x - this.ui.muteBtn.buffer && y < 120) {
            this.toggleMute();
            return;
        }
        const b = this.ui.bombBtn;
        if (x >= b.x - b.buffer && x <= b.x + b.w + b.buffer &&
            y >= b.y - b.buffer && y <= b.y + b.h + b.buffer) {
            if (this.state.gameRunning) this.dropBomb();
            else this.start();
            return;
        }

        // 2. Gameplay Actions (Atomic)
        if (!this.state.gameRunning) {
            this.start();
        } else {
            if (e.button === 2) this.dropBomb();
            if (e.button === 0) this.flap();
            if (e.preventDefault) e.preventDefault();
        }
    }

    toggleFullscreen() {
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (!isFS) {
            const container = this.canvas.parentElement;
            const request = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
            if (request) request.call(container);
        } else {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) exit.call(document);
        }
    }

    start() {
        if (this.state.assetsLoaded < this.config.worlds.length + 1) return;
        if (this.overlay) this.overlay.classList.remove('active');
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        Object.assign(this.state, {
            gameRunning: true, score: 0, directHits: 0, frameCount: 0,
            nextPipeFrame: 40, currentWorld: 0, bgX: 0, screenShake: 0, bombTimer: 0
        });
        Object.assign(this.player, { y: 150, velocity: 0, flipAngle: 0, isFlipping: false });

        this.pipes = [];
        this.bombs = [];
        this.floatingTexts = [];
        if (this.assets.music && !this.state.isMuted) {
            this.assets.music.currentTime = 0;
            this.assets.music.volume = 1.0;
            this.assets.music.play().catch(() => {});
        }
        this._loop();
    }

    toggleMute() {
        this.state.isMuted = !this.state.isMuted;
        if (this.assets.music) {
            if (this.state.isMuted) this.assets.music.pause();
            else if (this.state.gameRunning) this.assets.music.play();
        }
        if (!this.state.gameRunning) this.drawStartScreen();
    }

    flap() {
        this.player.velocity = this.config.lift;
        this.playSound('flap');
    }

    dropBomb() {
        if (this.state.bombTimer > 0) return;
        this.bombs.push({
            x: this.player.x + this.player.w / 2,
            y: this.player.y + this.player.h - 10,
            w: 15, h: 20, speed: 8
        });
        this.state.bombTimer = this.config.bombCooldown;
    }

    playSound(type) {
        if (this.state.isMuted) return;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain); gain.connect(this.audioCtx.destination);
        
        if (type === 'splat') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
            return;
        }

        const sounds = {
            flap: { type: 'square', freq: [150, 400], vol: 0.5, dur: 0.1 },
            score: { type: 'sine', freq: [800, 1200], vol: 0.4, dur: 0.1 },
            crash: { type: 'sawtooth', freq: [100, 20], vol: 0.6, dur: 0.5 },
            shift: { type: 'square', freq: [200, 800], vol: 0.5, dur: 0.3 }
        };
        const s = sounds[type];
        osc.type = s.type;
        osc.frequency.setValueAtTime(s.freq[0], now);
        osc.frequency.exponentialRampToValueAtTime(s.freq[1], now + s.dur);
        gain.gain.setValueAtTime(s.vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + s.dur);
        osc.start(now); osc.stop(now + s.dur);
    }

    _update() {
        if (!this.state.gameRunning) return;
        this.state.bgX = (this.state.bgX - this.config.bgSpeed) % this.canvas.width;
        this.player.velocity += this.config.gravity;
        this.player.y += this.player.velocity;
        if (this.state.bombTimer > 0) this.state.bombTimer--;
        if (this.state.screenShake > 0) this.state.screenShake *= 0.9;

        if (this.player.isFlipping) {
            this.player.flipAngle += this.player.flipDirection * this.player.flipSpeed;
            if (Math.abs(this.player.flipAngle) >= Math.PI * 2) {
                this.player.flipAngle = 0;
                this.player.isFlipping = false;
            }
        }

        if (this.state.frameCount >= this.state.nextPipeFrame) this._spawnPipe();
        this._updatePipes();
        this._updateBombs();
        this._updateBubbles();
        this._updateFloatingTexts();

        if (this.player.y + this.player.h > this.canvas.height || this.player.y < 0) this.gameOver();
        this.state.frameCount++;
    }

    _spawnPipe() {
        const h = Math.floor(Math.random() * (this.canvas.height - this.config.pipeGap - 150 - 60)) + 60;
        this.pipes.push({
            x: this.canvas.width, y: h, w: this.config.pipeWidth, gap: this.config.pipeGap,
            ad: this.config.ads[Math.floor(Math.random() * this.config.ads.length)],
            scored: false, stains: []
        });
        this.state.nextPipeFrame = this.state.frameCount + Math.floor(Math.random() * 50) + 100;
    }

    _updatePipes() {
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            p.x -= this.config.pipeSpeed;
            p.stains.forEach(s => s.drips.forEach(d => { if (d.len < d.maxLen) d.len += d.speed; }));
            if (this.player.x + 15 < p.x + p.w && this.player.x + this.player.w - 15 > p.x && (this.player.y + 15 < p.y || this.player.y + this.player.h - 15 > p.y + p.gap)) {
                this.gameOver();
            }
            if (!p.scored && p.x + p.w < this.player.x) {
                p.scored = true; this.state.score++; this.playSound('score');
                if (this.state.score % this.config.worldShiftInterval === 0) this._shiftWorld();
            }
            if (p.x + p.w < -100) this.pipes.splice(i, 1);
        }
    }

    _updateBombs() {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const b = this.bombs[i];
            b.y += b.speed;
            let hit = false;
            for (const p of this.pipes) {
                if (b.x > p.x && b.x < p.x + p.w && (b.y < p.y || b.y > p.y + p.gap)) {
                    this._createSplat(p, b.x, b.y); hit = true; break;
                }
            }
            if (hit || b.y > this.canvas.height) this.bombs.splice(i, 1);
        }
    }

    _createSplat(p, bx, by) {
        this.state.screenShake = 10;
        this.state.directHits++;
        this.player.isFlipping = true;
        this.player.flipDirection = Math.random() > 0.5 ? 1 : -1;
        this.player.flipAngle = 0;
        
        p.stains.push({
            relY: by, xOff: bx - p.x, size: Math.random() * 8 + 12,
            drips: Array.from({ length: 3 }, () => ({ xOff: (Math.random() - 0.5) * 20, len: 0, maxLen: 40 + Math.random() * 60, speed: 1.0 + Math.random() * 1.5, w: 3 + Math.random() * 4 }))
        });
        this.floatingTexts.push({
            x: bx, y: by, text: this.config.hitMessages[Math.floor(Math.random() * this.config.hitMessages.length)],
            alpha: 1, velocity: -1.5, scale: 1, color: this.config.msgColors[Math.floor(Math.random() * this.config.msgColors.length)]
        });
        this.playSound('splat');
    }

    _updateFloatingTexts() {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y += t.velocity; t.alpha -= 0.01; t.scale += 0.01;
            if (t.alpha <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    _updateBubbles() {
        this.bubbles.forEach(b => {
            b.x -= b.speed; if (b.x < -10) b.x = this.canvas.width + 10;
        });
    }

    _shiftWorld() {
        this.state.currentWorld = (this.state.currentWorld + 1) % this.assets.worlds.length;
        this.state.flashOpacity = 1; this.playSound('shift');
    }

    _draw() {
        this.ctx.save();
        if (this.state.screenShake > 0.5) {
            this.ctx.translate((Math.random() - 0.5) * this.state.screenShake, (Math.random() - 0.5) * this.state.screenShake);
        }
        this.ctx.clearRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
        this._renderBackground();
        this._renderBubbles();
        this._renderBombs();
        this._renderPipes();
        this._renderFloatingTexts();
        this._renderPlayer();
        this._renderHUD();
        this._renderFlash();
        this.ctx.restore();
    }

    _renderBackground() {
        const bg = this.assets.worlds[this.state.currentWorld];
        if (bg && bg.complete) {
            const rx = Math.floor(this.state.bgX);
            this.ctx.drawImage(bg, rx, 0, this.canvas.width + 2, this.canvas.height);
            this.ctx.drawImage(bg, rx + this.canvas.width, 0, this.canvas.width + 2, this.canvas.height);
        }
    }

    _renderBubbles() {
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        this.bubbles.forEach(b => {
            this.ctx.beginPath(); this.ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); this.ctx.fill();
        });
    }

    _renderBombs() {
        this.ctx.fillStyle = "#fff";
        this.bombs.forEach(b => {
            this.ctx.beginPath(); this.ctx.ellipse(b.x, b.y, b.w/2, b.h/2, 0, 0, Math.PI * 2); this.ctx.fill();
        });
    }

    _renderPipes() {
        this.pipes.forEach(p => {
            this.ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
            this.ctx.strokeStyle = p.ad.color; this.ctx.lineWidth = 4;
            this.ctx.fillRect(p.x, 0, p.w, p.y); this.ctx.strokeRect(p.x, -1, p.w, p.y + 1);
            this.ctx.fillRect(p.x, p.y + p.gap, p.w, this.canvas.height); this.ctx.strokeRect(p.x, p.y + p.gap, p.w, this.canvas.height + 1);

            [0, p.y + p.gap].forEach(startY => {
                this.ctx.save(); this.ctx.beginPath();
                this.ctx.rect(p.x, startY, p.w, startY === 0 ? p.y : this.canvas.height);
                this.ctx.clip(); this._drawStains(p); this.ctx.restore();
            });

            this.ctx.save();
            this.ctx.translate(p.x + p.w/2, p.y + p.gap + (this.canvas.height - (p.y + p.gap)) / 2);
            this.ctx.rotate(-Math.PI / 2); this.ctx.fillStyle = "#fff";
            this.ctx.font = "bold 18px 'Outfit', sans-serif"; this.ctx.textAlign = "center";
            this.ctx.shadowColor = p.ad.color; this.ctx.shadowBlur = 10;
            this.ctx.fillText(p.ad.text, 0, 0); this.ctx.restore();
        });
    }

    _drawStains(p) {
        p.stains.forEach(s => {
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            this.ctx.beginPath(); this.ctx.arc(p.x + s.xOff, s.relY, s.size, 0, Math.PI * 2); this.ctx.fill();
            s.drips.forEach(d => {
                this.ctx.beginPath(); this.ctx.roundRect(p.x + s.xOff + d.xOff, s.relY, d.w, d.len, d.w/2); this.ctx.fill();
            });
        });
    }

    _renderFloatingTexts() {
        this.ctx.textAlign = "center";
        this.floatingTexts.forEach(t => {
            this.ctx.save(); this.ctx.globalAlpha = t.alpha; this.ctx.translate(t.x, t.y); this.ctx.scale(t.scale, t.scale);
            this.ctx.fillStyle = t.color; this.ctx.font = "bold 26px 'Outfit', sans-serif";
            this.ctx.shadowBlur = 15; this.ctx.shadowColor = t.color;
            this.ctx.fillText(t.text, 0, 0); this.ctx.restore();
        });
    }

    _renderPlayer() {
        this.ctx.save();
        this.ctx.translate(this.player.x + this.player.w/2, this.player.y + this.player.h/2);
        const tilt = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.player.velocity * 0.05));
        this.ctx.rotate(tilt + this.player.flipAngle); this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.assets.player, -this.player.w/2, -this.player.h/2, this.player.w, this.player.h);
        this.ctx.restore();
    }

    _renderHUD() {
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center";
        this.ctx.font = "bold 48px 'Outfit', sans-serif"; this.ctx.fillText(this.state.score, this.ui.scoreCenter, 65);
        this.ctx.font = "bold 16px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.fillText(`MARKETING IMPACT: ${this.state.directHits}`, this.ui.scoreCenter, 90);
        this.ctx.font = "24px serif"; this.ctx.textAlign = "right";
        this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.ui.muteBtn.x, this.ui.muteBtn.y);

        this.ctx.save(); this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)";
        this.ctx.beginPath(); this.ctx.arc(this.ui.fullscreenBtn.x, this.ui.fullscreenBtn.y, this.ui.fullscreenBtn.radius, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.font = "bold 42px serif"; this.ctx.textAlign = "center"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        this.ctx.fillText("⤢", this.ui.fullscreenBtn.x, this.ui.fullscreenBtn.y + 13);
        this.ctx.restore();

        this.ctx.save(); this.ctx.beginPath();
        this.ctx.fillStyle = this.state.bombTimer > 0 ? "rgba(255, 255, 255, 0.15)" : "rgba(6, 182, 212, 0.6)";
        this.ctx.shadowBlur = 15; this.ctx.shadowColor = "#06b6d4";
        this.ctx.roundRect(this.ui.bombBtn.x, this.ui.bombBtn.y, this.ui.bombBtn.w, this.ui.bombBtn.h, this.ui.bombBtn.radius); this.ctx.fill();
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center";
        this.ctx.font = "bold 20px 'Outfit', sans-serif"; this.ctx.shadowBlur = 0;
        this.ctx.fillText("BOMB", this.ui.bombBtn.x + this.ui.bombBtn.w/2, this.ui.bombBtn.y + (this.isMobile ? 42 : 36)); 
        if (!this.isMobile) {
            this.ctx.font = "bold 9px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            this.ctx.fillText("(SHIFT / R-CLICK)", this.ui.bombBtn.x + this.ui.bombBtn.w/2, this.ui.bombBtn.y + 54);
        } 
        if (this.state.bombTimer > 0) {
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            this.ctx.fillRect(this.ui.bombBtn.x, this.ui.bombBtn.y + this.ui.bombBtn.h - 4, this.ui.bombBtn.w * (this.state.bombTimer / this.config.bombCooldown), 4);
        }
        this.ctx.restore();
    }

    _renderFlash() {
        if (this.state.flashOpacity > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.state.flashOpacity})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.state.flashOpacity -= 0.05;
        }
    }

    _loop() {
        this.state.lastRect = this.canvas.getBoundingClientRect();
        this._update(); this._draw();
        if (this.state.gameRunning) requestAnimationFrame(() => this._loop());
    }

    gameOver() {
        this.state.gameRunning = false; this.playSound('crash');
        if (this.assets.music) this.assets.music.pause();
        if (this.state.score > this.state.highScore) { this.state.highScore = this.state.score; localStorage.setItem('adBirdHighScore', this.state.highScore); }
        if (this.state.directHits > this.state.highDirectHits) { this.state.highDirectHits = this.state.directHits; localStorage.setItem('adBirdHighDirectHits', this.state.highDirectHits); }
        if (this.isMobile && this.overlay) this.overlay.classList.add('active');

        setTimeout(() => {
            this.ctx.fillStyle = "rgba(0,0,0,0.85)"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "#fff"; this.ctx.font = "bold 32px 'Outfit', sans-serif"; this.ctx.textAlign = "center";
            this.ctx.fillText("AD-BIRD LOST AT SEA", this.canvas.width / 2, this.canvas.height / 2 - 60);
            this.ctx.font = "bold 20px 'Outfit', sans-serif";
            this.ctx.fillText(`Score: ${this.state.score}`, this.canvas.width / 2 - 80, this.canvas.height / 2);
            this.ctx.fillStyle = "#fbbf24"; this.ctx.fillText(`Best: ${this.state.highScore}`, this.canvas.width / 2 + 80, this.canvas.height / 2);
            this.ctx.fillStyle = "#fff"; this.ctx.fillText(`Impact: ${this.state.directHits}`, this.canvas.width / 2 - 80, this.canvas.height / 2 + 35);
            this.ctx.fillStyle = "#06b6d4"; this.ctx.fillText(`Best: ${this.state.highDirectHits}`, this.canvas.width / 2 + 80, this.canvas.height / 2 + 35);
            this.ctx.fillStyle = "rgba(255,255,255,0.5)"; this.ctx.font = "14px 'Outfit', sans-serif";
            this.ctx.fillText(this.isMobile ? "TAP to fly again" : "SPACE or CLICK to fly again", this.canvas.width / 2, this.canvas.height / 2 + 85);
        }, 10);
    }

    drawStartScreen() {
        if (this.isMobile && this.overlay) this.overlay.classList.add('active');
        this.ctx.fillStyle = "#050510"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const bg = this.assets.worlds[0];
        if (bg && bg.complete) this.ctx.drawImage(bg, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
        this.ctx.fillRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 60, 400, 135);
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 60, 400, 135);
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center";
        this.ctx.font = "bold 24px 'Outfit', sans-serif"; this.ctx.fillText("READY TO DROP SOME ADS?", this.canvas.width / 2, this.canvas.height / 2 - 10);
        this.ctx.font = "15px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.fillText(this.isMobile ? "TAP ANYWHERE to flap" : "SPACE or CLICK to flap", this.canvas.width / 2, this.canvas.height / 2 + 30);
        this.ctx.fillText(this.isMobile ? "BOMB BUTTON to drop ads" : "SHIFT or R-CLICK to bomb", this.canvas.width / 2, this.canvas.height / 2 + 55);
        this.ctx.font = "24px serif"; this.ctx.textAlign = "right";
        this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.ui.muteBtn.x, this.ui.muteBtn.y);
    }
}
function initGlobalUI() {
    const toggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');
    if (toggle && navLinks) {
        toggle.onclick = (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
        };
        // Close menu when clicking outside
        document.addEventListener('click', () => navLinks.classList.remove('active'));
        navLinks.onclick = (e) => e.stopPropagation();
    }
}

// Initialize with DOM safety
document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    
    // Delay Game Engine slightly to allow First Paint
    setTimeout(() => {
        window.adBirdGame = new AdBird('adBirdCanvas');
    }, 100);
});
