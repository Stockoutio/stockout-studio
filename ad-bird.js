/**
 * Ad-Bird: Stockout Studio Edition
 * A modular, high-performance arcade engine for billboard-smashing action.
 */

class AdBird {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.config = {
            gravity: options.gravity || 0.5,
            lift: options.lift || -7,
            pipeWidth: options.pipeWidth || 80,
            pipeGap: options.pipeGap || 230,
            pipeSpeed: options.pipeSpeed || 2.2,
            bgSpeed: options.bgSpeed || 0.5,
            bubbleCount: options.bubbleCount || 20,
            worldShiftInterval: options.worldShiftInterval || 10,
            playerImg: options.playerImg || 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png',
            musicSrc: options.musicSrc || 'bg-music.mp3',
            worlds: options.worlds || ['world1.jpg', 'world2.jpg', 'world3.jpg'],
            ads: options.ads || [
                { text: "YOUR AD HERE", color: "#4ade80" },
                { text: "BUY BITCOIN", color: "#f59e0b" },
                { text: "FOLLOW ME", color: "#06b6d4" }
            ],
            hitMessages: [
                "WASTED", "REKT", "STAINED", "SPLAT", "GET REKT", 
                "BILLBOARDED", "SIGN SMASHED", "MESSY", "BULLSEYE",
                "AD-BLASTED", "INKED", "VANDALIZED", "SCORE!",
                "BIRDPOCALYPSE", "BEAK-TACULAR", "EGG-STERMINATION", "UN-BEAK-ABLE",
                "FLAPPING SPREE", "WING-SLAUGHTER", "FEATHER-KILL", "DOUBLE BILL",
                "TRIPLE TWEET", "OVER-FLAP", "BILL-IONAIRE"
            ],
            msgColors: ["#a855f7", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899"]
        };

        this.state = {
            gameRunning: false,
            score: 0,
            frameCount: 0,
            nextPipeFrame: 40,
            currentWorld: 0,
            flashOpacity: 0,
            isMuted: false,
            bgX: 0,
            screenShake: 0
        };

        this.player = { x: 250, y: 150, w: 70, h: 70, velocity: 0 };
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
        this.assets.player.src = this.config.playerImg;
        this.config.worlds.forEach((path) => {
            const img = new Image();
            img.src = path;
            img.onload = () => { if (!this.state.gameRunning) this.drawStartScreen(); };
            this.assets.worlds.push(img);
        });

        window.addEventListener('keydown', (e) => this._handleKeydown(e));
        this.canvas.addEventListener('mousedown', (e) => this._handleMousedown(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
        }
    }

    _handleMousedown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x > this.canvas.width - 60 && y < 60) {
            this.toggleMute();
            return;
        }

        if (!this.state.gameRunning) {
            this.start();
        } else {
            if (e.button === 0) this.flap();
            else if (e.button === 2) this.dropBomb();
        }
    }

    start() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        Object.assign(this.state, {
            gameRunning: true, score: 0, frameCount: 0, nextPipeFrame: 40, currentWorld: 0, bgX: 0, screenShake: 0
        });
        this.player.y = 150;
        this.player.velocity = 0;
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
        this.bombs.push({
            x: this.player.x + this.player.w / 2,
            y: this.player.y + this.player.h - 10,
            w: 15, h: 20, speed: 8
        });
    }

    playSound(type) {
        if (this.state.isMuted) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        const now = this.audioCtx.currentTime;
        
        if (type === 'splat') {
            // Victorious Synth Sequence
            const freqs = [300, 450, 600];
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freqs[0], now);
            osc.frequency.exponentialRampToValueAtTime(freqs[1], now + 0.1);
            osc.frequency.exponentialRampToValueAtTime(freqs[2], now + 0.2);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            return;
        }

        const sounds = {
            flap: { type: 'square', freq: [150, 400], vol: 0.4, dur: 0.1 },
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
        osc.start(now);
        osc.stop(now + s.dur);
    }

    _update() {
        if (!this.state.gameRunning) return;
        this.state.bgX = (this.state.bgX - this.config.bgSpeed) % this.canvas.width;
        this.player.velocity += this.config.gravity;
        this.player.y += this.player.velocity;

        if (this.state.screenShake > 0) this.state.screenShake *= 0.9;

        if (this.state.frameCount >= this.state.nextPipeFrame) this._spawnPipe();
        this._updatePipes();
        this._updateBombs();
        this._updateBubbles();
        this._updateFloatingTexts();
        if (this.player.y + this.player.h > this.canvas.height || this.player.y < 0) this.gameOver();
        this.state.frameCount++;
    }

    _spawnPipe() {
        const minBottomHeight = 150;
        const maxTopHeight = this.canvas.height - this.config.pipeGap - minBottomHeight;
        const h = Math.floor(Math.random() * (maxTopHeight - 60)) + 60;
        this.pipes.push({
            x: this.canvas.width, y: h, w: this.config.pipeWidth, gap: this.config.pipeGap,
            ad: this.config.ads[Math.floor(Math.random() * this.config.ads.length)], scored: false, stains: []
        });
        this.state.nextPipeFrame = this.state.frameCount + Math.floor(Math.random() * 50) + 100;
    }

    _updatePipes() {
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            p.x -= this.config.pipeSpeed;
            p.stains.forEach(s => { s.drips.forEach(d => { if (d.len < d.maxLen) d.len += d.speed; }); });
            if (this.player.x + 15 < p.x + p.w && this.player.x + this.player.w - 15 > p.x &&
                (this.player.y + 15 < p.y || this.player.y + this.player.h - 15 > p.y + p.gap)) this.gameOver();
            if (!p.scored && p.x + p.w < this.player.x) {
                p.scored = true; this.state.score++; this.playSound('score');
                if (this.state.score % this.config.worldShiftInterval === 0) this._shiftWorld();
            }
            if (p.x + p.w < -100) this.pipes.splice(i, 1);
        }
    }

    _updateBombs() {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const b = this.bombs[i]; b.y += b.speed; let hit = false;
            for (const p of this.pipes) {
                const hitTop = b.x > p.x && b.x < p.x + p.w && b.y < p.y;
                const hitBottom = b.x > p.x && b.x < p.x + p.w && b.y > p.y + p.gap;
                if (hitTop || hitBottom) { this._createSplat(p, b.x, b.y); hit = true; break; }
            }
            if (hit || b.y > this.canvas.height) this.bombs.splice(i, 1);
        }
    }

    _createSplat(p, bx, by) {
        this.state.screenShake = 10;
        const dripCount = 2 + Math.floor(Math.random() * 2);
        const drips = Array.from({ length: dripCount }, () => ({
            xOff: (Math.random() - 0.5) * 20, len: 0, maxLen: 40 + Math.random() * 60,
            speed: 1.0 + Math.random() * 1.5, w: 3 + Math.random() * 4
        }));
        p.stains.push({ relY: by, xOff: bx - p.x, size: Math.random() * 8 + 12, drips: drips });
        
        const msg = this.config.hitMessages[Math.floor(Math.random() * this.config.hitMessages.length)];
        this.floatingTexts.push({ 
            x: bx, y: by, text: msg, alpha: 1, velocity: -1.5, scale: 1, 
            color: this.config.msgColors[Math.floor(Math.random() * this.config.msgColors.length)]
        });
        this.playSound('splat');
    }

    _updateFloatingTexts() {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i]; t.y += t.velocity; t.alpha -= 0.02; t.scale += 0.01;
            if (t.alpha <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    _updateBubbles() {
        this.bubbles.forEach(b => { b.x -= b.speed; if (b.x < -10) b.x = this.canvas.width + 10; });
    }

    _shiftWorld() {
        this.state.currentWorld = (this.state.currentWorld + 1) % this.assets.worlds.length;
        this.state.flashOpacity = 1; this.playSound('shift');
    }

    _draw() {
        this.ctx.save();
        if (this.state.screenShake > 0.5) {
            const sx = (Math.random() - 0.5) * this.state.screenShake;
            const sy = (Math.random() - 0.5) * this.state.screenShake;
            this.ctx.translate(sx, sy);
        }

        this.ctx.clearRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
        this._renderBackground(); this._renderBubbles(); this._renderBombs(); this._renderPipes();
        this._renderFloatingTexts(); this._renderPlayer(); this._renderHUD(); this._renderFlash();
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
        this.bubbles.forEach(b => { this.ctx.beginPath(); this.ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); this.ctx.fill(); });
    }

    _renderBombs() {
        this.ctx.fillStyle = "#fff";
        this.bombs.forEach(b => { this.ctx.beginPath(); this.ctx.ellipse(b.x, b.y, b.w/2, b.h/2, 0, 0, Math.PI * 2); this.ctx.fill(); });
    }

    _renderPipes() {
        this.pipes.forEach(p => {
            this.ctx.fillStyle = "rgba(10, 10, 15, 0.85)"; this.ctx.strokeStyle = p.ad.color; this.ctx.lineWidth = 4;
            this.ctx.fillRect(p.x, 0, p.w, p.y); this.ctx.strokeRect(p.x, -1, p.w, p.y + 1);
            this.ctx.fillRect(p.x, p.y + p.gap, p.w, this.canvas.height); this.ctx.strokeRect(p.x, p.y + p.gap, p.w, this.canvas.height + 1);
            this._renderClippedStains(p, true); this._renderClippedStains(p, false);
            const bTop = p.y + p.gap; const bHeight = this.canvas.height - bTop; const adY = bTop + (bHeight / 2);
            this.ctx.save(); this.ctx.translate(p.x + p.w/2, adY); this.ctx.rotate(-Math.PI / 2);
            this.ctx.fillStyle = "#fff"; this.ctx.font = "bold 13px 'Outfit', sans-serif"; this.ctx.textAlign = "center";
            this.ctx.shadowColor = p.ad.color; this.ctx.shadowBlur = 10; this.ctx.fillText(p.ad.text, 0, 0); this.ctx.restore();
        });
    }

    _renderClippedStains(p, isTop) {
        this.ctx.save(); this.ctx.beginPath();
        if (isTop) this.ctx.rect(p.x, 0, p.w, p.y); else this.ctx.rect(p.x, p.y + p.gap, p.w, this.canvas.height);
        this.ctx.clip();
        p.stains.forEach(s => {
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; this.ctx.beginPath(); this.ctx.arc(p.x + s.xOff, s.relY, s.size, 0, Math.PI * 2); this.ctx.fill();
            s.drips.forEach(d => { this.ctx.beginPath(); this.ctx.roundRect(p.x + s.xOff + d.xOff, s.relY, d.w, d.len, d.w/2); this.ctx.fill(); });
        });
        this.ctx.restore();
    }

    _renderFloatingTexts() {
        this.ctx.textAlign = "center";
        this.floatingTexts.forEach(t => {
            this.ctx.save();
            this.ctx.globalAlpha = t.alpha;
            const shake = (Math.random() - 0.5) * 4;
            this.ctx.translate(t.x + shake, t.y + shake);
            this.ctx.scale(t.scale, t.scale);
            this.ctx.fillStyle = t.color;
            this.ctx.font = "bold 22px 'Outfit', sans-serif";
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = t.color;
            this.ctx.fillText(t.text, 0, 0);
            this.ctx.restore();
        });
    }

    _renderPlayer() {
        this.ctx.save();
        this.ctx.translate(this.player.x + this.player.w/2, this.player.y + this.player.h/2);
        this.ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.player.velocity * 0.05)));
        this.ctx.scale(-1, 1); this.ctx.drawImage(this.assets.player, -this.player.w/2, -this.player.h/2, this.player.w, this.player.h);
        this.ctx.restore();
    }

    _renderHUD() {
        this.ctx.fillStyle = "#fff"; this.ctx.font = "bold 48px 'Outfit', sans-serif"; this.ctx.textAlign = "center";
        this.ctx.fillText(this.state.score, this.canvas.width / 2, 65);
        this.ctx.font = "22px serif"; this.ctx.textAlign = "right";
        this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.canvas.width - 20, 45);
    }

    _renderFlash() {
        if (this.state.flashOpacity > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.state.flashOpacity})`; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.state.flashOpacity -= 0.05;
        }
    }

    _loop() { this._update(); this._draw(); if (this.state.gameRunning) requestAnimationFrame(() => this._loop()); }

    gameOver() {
        this.state.gameRunning = false; this.playSound('crash');
        if (this.assets.music) this.assets.music.pause();
        setTimeout(() => {
            this.ctx.fillStyle = "rgba(0,0,0,0.85)"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "#fff"; this.ctx.font = "bold 32px 'Outfit', sans-serif"; this.ctx.textAlign = "center";
            this.ctx.fillText("AD-BIRD LOST AT SEA", this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = "20px 'Outfit', sans-serif"; this.ctx.fillText(`Score: ${this.state.score}`, this.canvas.width / 2, this.canvas.height / 2 + 25);
            this.ctx.fillStyle = "rgba(255,255,255,0.5)"; this.ctx.font = "14px 'Outfit', sans-serif";
            this.ctx.fillText("SPACE or L-CLICK to flap", this.canvas.width / 2, this.canvas.height / 2 + 60);
            this.ctx.fillText("SHIFT or R-CLICK to bomb", this.canvas.width / 2, this.canvas.height / 2 + 85);
        }, 10);
    }

    drawStartScreen() {
        this.ctx.fillStyle = "#050510"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const bg = this.assets.worlds[0]; if (bg && bg.complete) this.ctx.drawImage(bg, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)"; this.ctx.fillRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 60, 400, 135);
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; this.ctx.lineWidth = 1; this.ctx.strokeRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 60, 400, 135);
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.font = "bold 24px 'Outfit', sans-serif";
        this.ctx.fillText("READY TO DROP SOME ADS?", this.canvas.width / 2, this.canvas.height / 2 - 10);
        this.ctx.font = "15px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.fillText("SPACE or L-CLICK to flap", this.canvas.width / 2, this.canvas.height / 2 + 30);
        this.ctx.fillText("SHIFT or R-CLICK to bomb", this.canvas.width / 2, this.canvas.height / 2 + 55);
        this.ctx.font = "20px serif"; this.ctx.textAlign = "right"; this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.canvas.width - 20, 45);
    }
}
window.adBirdGame = new AdBird('adBirdCanvas');
