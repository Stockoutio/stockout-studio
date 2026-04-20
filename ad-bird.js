/**
 * Ad-Bird-tising Game Engine
 * High-performance marketing, one flap at a time.
 */

class AdBird {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
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

        this.config = {
            gravity: 0.25, lift: -5.5, pipeSpeed: 3.5, pipeWidth: 80, pipeGap: 230,
            bgSpeed: 1, worldShiftInterval: 5, bombCooldown: 60,
            hitMessages: ["SPLAT!", "AD INJECTED!", "MARKETED!", "IMPACT!", "BRANDED!", "CONVERTED!"],
            msgColors: ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6"],
            ads: [
                // Placeholder / meta
                { text: "YOUR AD HERE", color: "#60a5fa" },
                { text: "BUY THIS PIPE", color: "#fbbf24" },
                { text: "RENT ME $5", color: "#34d399" },
                { text: "SPONSORED", color: "#f87171" },
                { text: "AD SLOT OPEN", color: "#a78bfa" },
                { text: "SEO LIVES HERE", color: "#f472b6" },
                { text: "CPC: $0.04", color: "#60a5fa" },
                { text: "IMPRESSIONS++", color: "#34d399" },
                { text: "SPOT VACANT", color: "#fbbf24" },

                // Fake brands
                { text: "BIG PIPE CO", color: "#60a5fa" },
                { text: "PIPES.IO", color: "#34d399" },
                { text: "FLAP & CO", color: "#fbbf24" },
                { text: "PIPE DEPOT", color: "#f87171" },
                { text: "DUCTMART", color: "#a78bfa" },
                { text: "TUBE & SON", color: "#f472b6" },

                // Startup parody
                { text: "WE'RE HIRING", color: "#34d399" },
                { text: "PIPES AS A SERVICE", color: "#60a5fa" },
                { text: "SERIES A PIPE", color: "#fbbf24" },
                { text: "DISRUPT PIPES", color: "#f87171" },
                { text: "GO PUBLIC SOON", color: "#a78bfa" },
                { text: "PIPE TO THE MOON", color: "#f472b6" },
                { text: "WEB3 PIPE", color: "#60a5fa" },

                // Self-aware / fourth wall
                { text: "DON'T BOMB ME", color: "#f87171" },
                { text: "PLEASE NO", color: "#fbbf24" },
                { text: "AVOID THIS PIPE", color: "#34d399" },
                { text: "NOT A BILLBOARD", color: "#60a5fa" },
                { text: "DUCK!", color: "#f87171" },
                { text: "INCOMING", color: "#fbbf24" },
                { text: "OUCH", color: "#f472b6" },
                { text: "RIP THIS PIPE", color: "#a78bfa" },
                { text: "I HAVE A FAMILY", color: "#34d399" },

                // Crypto / finance
                { text: "BUY BITCOIN", color: "#fbbf24" },
                { text: "HODL", color: "#34d399" },
                { text: "DIAMOND PIPES", color: "#60a5fa" },
                { text: "PIPE ETF", color: "#a78bfa" },
                { text: "SHORT THE BIRD", color: "#f87171" },
                { text: "LONG ON GUANO", color: "#34d399" },
                { text: "ROTH IRAPIPE", color: "#f472b6" },

                // Wordplay on "pipe"
                { text: "PIPE DREAMS", color: "#60a5fa" },
                { text: "PIPELINE FULL", color: "#34d399" },
                { text: "PIPE ME UP", color: "#fbbf24" },
                { text: "DOWN THE PIPE", color: "#f87171" },
                { text: "PIPE IT UP", color: "#a78bfa" },
                { text: "HOT PIPE", color: "#f472b6" },
                { text: "DRAIN PIPE 9", color: "#60a5fa" },
                { text: "CLOG FREE", color: "#34d399" },

                // Bird-related burns
                { text: "FLY AWAY BIRD", color: "#f87171" },
                { text: "NEST ELSEWHERE", color: "#fbbf24" },
                { text: "BIRD-PROOF", color: "#60a5fa" },
                { text: "ANTI-BIRD", color: "#a78bfa" },
                { text: "NO BIRDS ALLOWED", color: "#f87171" },
                { text: "BEAK OFF", color: "#f472b6" },
                { text: "BIRD REPELLENT", color: "#34d399" },
                { text: "TALON-TESTED", color: "#60a5fa" },

                // Random absurd
                { text: "EGGS ON SALE", color: "#fbbf24" },
                { text: "FREE WI-FI", color: "#34d399" },
                { text: "CALL YOUR MOM", color: "#f472b6" },
                { text: "MISS YOU MOM", color: "#a78bfa" },
                { text: "HI MOM", color: "#f87171" },
                { text: "THIS IS FINE", color: "#fbbf24" },
                { text: "LIVE LAUGH LOVE", color: "#f472b6" },
                { text: "NAMASTE", color: "#34d399" },
                { text: "TOUCH GRASS", color: "#60a5fa" },

                // Fake URLs / CTAs
                { text: "VISIT MY SITE", color: "#60a5fa" },
                { text: "DM FOR RATES", color: "#34d399" },
                { text: "LOOK AT ME", color: "#fbbf24" },
                { text: "STOCKOUT.IO", color: "#f472b6" },
                { text: "AD-BIRD.EXE", color: "#a78bfa" },
                { text: "FLAPPY ADS?", color: "#f87171" },

                // Philosophy / Abstract
                { text: "WHAT IS PIPE", color: "#a78bfa" },
                { text: "THE END IS PIPE", color: "#f87171" },
                { text: "EXISTENTIAL PIPE", color: "#60a5fa" },
                { text: "DEEP PIPE", color: "#34d399" }
            ],
            worlds: ["hero-bg.jpg", "cave-bg.jpg", "space-bg.jpg"]
        };

        this.state = {
            gameRunning: false,
            score: 0,
            directHits: 0,
            frameCount: 0,
            nextPipeFrame: 0,
            currentWorld: 0,
            bgX: 0,
            screenShake: 0,
            bombTimer: 0,
            highScore: parseInt(localStorage.getItem('adBirdHighScore')) || 0,
            highDirectHits: parseInt(localStorage.getItem('adBirdHighDirectHits')) || 0,
            assetsLoaded: 0,
            isMuted: false,
            flashOpacity: 0
        };

        this.player = { x: 50, y: 150, w: 40, h: 30, velocity: 0, flipAngle: 0, isFlipping: false, flipDirection: 1, flipSpeed: 0.2 };
        this.pipes = [];
        this.bombs = [];
        this.floatingTexts = [];
        this.bubbles = Array.from({ length: 15 }, () => ({ x: Math.random() * 600, y: Math.random() * 600, size: Math.random() * 3 + 1, speed: Math.random() * 0.5 + 0.2 }));
        
        this.isMobile = 'ontouchstart' in window;
        this.ui = {
            scoreCenter: this.canvas.width / 2,
            muteBtn: { x: this.canvas.width - 25, y: 25 },
            fullscreenBtn: { x: 30, y: 30, radius: 20 },
            bombBtn: { x: this.canvas.width / 2 - 50, y: this.canvas.height - 80, w: 100, h: 60, radius: 10 }
        };

        this.overlay = document.getElementById('gameOverlay');
        this.assets = { player: new Image(), worlds: [], music: null };
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this._loadAssets();
        this._bindInput();
    }

    _loadAssets() {
        this.assets.player.src = 'puffer.png';
        this.assets.player.onload = () => this.state.assetsLoaded++;
        this.config.worlds.forEach(src => {
            const img = new Image(); img.src = src;
            img.onload = () => { this.state.assetsLoaded++; this.assets.worlds.push(img); if (!this.state.gameRunning) this.drawStartScreen(); };
        });
        this.assets.music = new Audio('bg-music.mp3');
        this.assets.music.loop = true;
    }

    _bindInput() {
        const handler = (e) => {
            if (e.type === 'mousedown' && e.button === 2) { this.dropBomb(); e.preventDefault(); return; }
            if (e.type === 'keydown' && e.code === 'ShiftLeft') { this.dropBomb(); return; }
            if (!this.state.gameRunning) { this.start(); return; }
            this.flap();
        };

        window.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') handler(e); });
        this.canvas.addEventListener('mousedown', handler);
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        if (this.isMobile) {
            this.canvas.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const tx = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
                const ty = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
                
                if (Math.hypot(tx - this.ui.fullscreenBtn.x, ty - this.ui.fullscreenBtn.y) < this.ui.fullscreenBtn.radius) { this.toggleFullscreen(); return; }
                if (tx > this.ui.bombBtn.x && tx < this.ui.bombBtn.x + this.ui.bombBtn.w && ty > this.ui.bombBtn.y && ty < this.ui.bombBtn.y + this.ui.bombBtn.h) { this.dropBomb(); return; }
                handler(e);
            }, { passive: false });
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
            alpha: 1, velocity: -1.5, scale: 1, color: this.config.msgColors[Math.floor(Math.random() * this.config.hitMessages.length)]
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
            this.ctx.font = "bold 13px 'Outfit', sans-serif"; this.ctx.textAlign = "center";
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
            this.ctx.fillStyle = t.color; this.ctx.font = "bold 22px 'Outfit', sans-serif";
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
        this.ctx.font = "bold 14px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
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
        this.ctx.font = "bold 18px 'Outfit', sans-serif"; this.ctx.shadowBlur = 0;
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
