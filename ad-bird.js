/**
 * Ad-Bird: Stockout Studio Edition
 * A modular, self-contained game engine.
 */

class AdBird {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with id "${canvasId}" not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Configurable Settings
        this.config = {
            gravity: options.gravity || 0.5,
            lift: options.lift || -7,
            pipeWidth: options.pipeWidth || 80,
            pipeGap: options.pipeGap || 200,
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
            ]
        };

        // Internal State
        this.state = {
            gameRunning: false,
            score: 0,
            frameCount: 0,
            nextPipeFrame: 40,
            currentWorld: 0,
            lastMilestone: 0,
            flashOpacity: 0,
            isMuted: false,
            bgX: 0
        };

        // Game Objects
        this.player = { x: 300, y: 150, w: 70, h: 70, velocity: 0 };
        this.pipes = [];
        this.bombs = [];
        this.bubbles = [];
        
        // Asset Loading
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
        // Load Images
        this.assets.player.src = this.config.playerImg;
        this.config.worlds.forEach((path, i) => {
            const img = new Image();
            img.src = path;
            img.onload = () => { if (!this.state.gameRunning) this.drawStartScreen(); };
            this.assets.worlds.push(img);
        });

        // Event Listeners
        window.addEventListener('keydown', (e) => this._handleKeydown(e));
        this.canvas.addEventListener('mousedown', (e) => this._handleMousedown(e));

        this._initBubbles();
        
        // Initial Draw
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
        if (e.code === 'Space') {
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

        if (!this.state.gameRunning) this.start();
        else this.flap();
    }

    start() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        Object.assign(this.state, {
            gameRunning: true,
            score: 0,
            frameCount: 0,
            nextPipeFrame: 40,
            currentWorld: 0,
            lastMilestone: 0,
            bgX: 0
        });

        this.player.y = 150;
        this.player.velocity = 0;
        this.pipes = [];
        this.bombs = [];

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
            w: 10, h: 15, speed: 8
        });
    }

    playSound(type) {
        if (this.state.isMuted) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        const now = this.audioCtx.currentTime;

        const sounds = {
            flap: { type: 'square', freq: [150, 400], vol: 0.4, dur: 0.1 },
            score: { type: 'sine', freq: [800, 1200], vol: 0.4, dur: 0.1 },
            crash: { type: 'sawtooth', freq: [100, 20], vol: 0.6, dur: 0.5 },
            shift: { type: 'square', freq: [200, 800], vol: 0.5, dur: 0.3 },
            splat: { type: 'triangle', freq: [150, 50], vol: 0.2, dur: 0.2 }
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

        if (this.state.frameCount >= this.state.nextPipeFrame) this.spawnPipe();
        
        this._updatePipes();
        this._updateBombs();
        this._updateBubbles();

        if (this.player.y + this.player.h > this.canvas.height || this.player.y < 0) {
            this.gameOver();
        }

        this.state.frameCount++;
    }

    spawnPipe() {
        const minBottomHeight = 150; // Guaranteed space for ad text
        const maxTopHeight = this.canvas.height - this.config.pipeGap - minBottomHeight;
        const h = Math.floor(Math.random() * (maxTopHeight - 60)) + 60;
        
        this.pipes.push({
            x: this.canvas.width,
            y: h,
            w: this.config.pipeWidth,
            gap: this.config.pipeGap,
            ad: this.config.ads[Math.floor(Math.random() * this.config.ads.length)],
            scored: false,
            stains: []
        });
        this.state.nextPipeFrame = this.state.frameCount + Math.floor(Math.random() * 50) + 100;
    }

    _updatePipes() {
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            p.x -= this.config.pipeSpeed;

            // Update stain drips
            p.stains.forEach(s => {
                s.drips.forEach(d => {
                    if (d.len < d.maxLen) d.len += d.speed;
                });
            });

            if (this.player.x + 15 < p.x + p.w && this.player.x + this.player.w - 15 > p.x &&
                (this.player.y + 15 < p.y || this.player.y + this.player.h - 15 > p.y + p.gap)) {
                this.gameOver();
            }

            if (!p.scored && p.x + p.w < this.player.x) {
                p.scored = true;
                this.state.score++;
                this.playSound('score');
                if (this.state.score % this.config.worldShiftInterval === 0) this.shiftWorld();
            }

            if (p.x + p.w < 0) this.pipes.splice(i, 1);
        }
    }

    _updateBombs() {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const b = this.bombs[i];
            b.y += b.speed;
            let hit = false;
            this.pipes.forEach(p => {
                const hitTop = b.x > p.x && b.x < p.x + p.w && b.y < p.y;
                const hitBottom = b.x > p.x && b.x < p.x + p.w && b.y > p.y + p.gap;
                
                if (hitTop || hitBottom) {
                    const dripCount = 2 + Math.floor(Math.random() * 2);
                    const drips = Array.from({ length: dripCount }, () => ({
                        xOff: (Math.random() - 0.5) * 20,
                        len: 0,
                        maxLen: 20 + Math.random() * 40,
                        speed: 0.5 + Math.random() * 0.5,
                        w: 3 + Math.random() * 4
                    }));

                    p.stains.push({ 
                        relY: b.y, 
                        xOff: b.x - p.x, 
                        size: Math.random() * 8 + 12,
                        drips: drips
                    });
                    this.playSound('splat');
                    hit = true;
                }
            });
            if (hit || b.y > this.canvas.height) this.bombs.splice(i, 1);
        }
    }

    _updateBubbles() {
        this.bubbles.forEach(b => {
            b.x -= b.speed;
            if (b.x < -10) b.x = this.canvas.width + 10;
        });
    }

    shiftWorld() {
        this.state.currentWorld = (this.state.currentWorld + 1) % this.assets.worlds.length;
        this.state.flashOpacity = 1;
        this.playSound('shift');
    }

    _drawStains(p, isTop) {
        const { ctx } = this;
        ctx.save();
        ctx.beginPath();
        if (isTop) {
            ctx.rect(p.x, 0, p.w, p.y);
        } else {
            ctx.rect(p.x, p.y + p.gap, p.w, this.canvas.height - (p.y + p.gap));
        }
        ctx.clip();

        p.stains.forEach(s => {
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.beginPath();
            ctx.arc(p.x + s.xOff, s.relY, s.size, 0, Math.PI * 2);
            ctx.fill();
            s.drips.forEach(d => {
                ctx.beginPath();
                ctx.roundRect(p.x + s.xOff + d.xOff, s.relY, d.w, d.len, d.w/2);
                ctx.fill();
            });
        });
        ctx.restore();
    }

    _draw() {
        const { ctx, canvas, state, player, pipes, bombs, bubbles, assets } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // BG
        const bg = assets.worlds[state.currentWorld];
        if (bg && bg.complete) {
            const rx = Math.floor(state.bgX);
            ctx.drawImage(bg, rx, 0, canvas.width + 2, canvas.height);
            ctx.drawImage(bg, rx + canvas.width, 0, canvas.width + 2, canvas.height);
        }

        // Bubbles
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        bubbles.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Bombs
        ctx.fillStyle = "#fff";
        bombs.forEach(b => {
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, b.w/2, b.h/2, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        // Pipes
        pipes.forEach(p => {
            ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
            ctx.strokeStyle = p.ad.color;
            ctx.lineWidth = 4;
            
            ctx.fillRect(p.x, 0, p.w, p.y);
            ctx.strokeRect(p.x, -1, p.w, p.y + 1);
            ctx.fillRect(p.x, p.y + p.gap, p.w, canvas.height);
            ctx.strokeRect(p.x, p.y + p.gap, p.w, canvas.height + 1);

            this._drawStains(p, true);  // Top
            this._drawStains(p, false); // Bottom

            // Ad Text - Only on BOTTOM pipe
            const bottomPipeTop = p.y + p.gap;
            const bottomPipeHeight = canvas.height - bottomPipeTop;
            const adY = bottomPipeTop + (bottomPipeHeight / 2);
            
            ctx.save();
            ctx.translate(p.x + p.w/2, adY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 13px 'Outfit', sans-serif";
            ctx.textAlign = "center";
            ctx.shadowColor = p.ad.color;
            ctx.shadowBlur = 10;
            ctx.fillText(p.ad.text, 0, 0);
            ctx.restore();
        });

        // Player
        ctx.save();
        ctx.translate(player.x + player.w/2, player.y + player.h/2);
        ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, player.velocity * 0.05)));
        ctx.scale(-1, 1);
        ctx.drawImage(assets.player, -player.w/2, -player.h/2, player.w, player.h);
        ctx.restore();

        // UI
        ctx.fillStyle = "#fff";
        ctx.font = "bold 28px 'Outfit', sans-serif";
        ctx.fillText(state.score, 25, 45);
        ctx.font = "22px serif";
        ctx.fillText(state.isMuted ? "🔇" : "🔊", canvas.width - 20, 45);

        if (state.flashOpacity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${state.flashOpacity})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            this.state.flashOpacity -= 0.05;
        }
    }

    _loop() {
        this._update();
        this._draw();
        if (this.state.gameRunning) requestAnimationFrame(() => this._loop());
    }

    gameOver() {
        this.state.gameRunning = false;
        this.playSound('crash');
        if (this.assets.music) this.assets.music.pause();

        setTimeout(() => {
            this.ctx.fillStyle = "rgba(0,0,0,0.85)";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "bold 32px 'Outfit', sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText("AD-BIRD LOST AT SEA", this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = "20px 'Outfit', sans-serif";
            this.ctx.fillText(`Score: ${this.state.score}`, this.canvas.width / 2, this.canvas.height / 2 + 25);
            this.ctx.fillStyle = "rgba(255,255,255,0.5)";
            this.ctx.font = "14px 'Outfit', sans-serif";
            this.ctx.fillText("SPACE or CLICK to respawn", this.canvas.width / 2, this.canvas.height / 2 + 60);
        }, 10);
    }

    drawStartScreen() {
        this.ctx.fillStyle = "#050510";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const bg = this.assets.worlds[0];
        if (bg && bg.complete) this.ctx.drawImage(bg, 0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
        this.ctx.fillRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 60, 400, 120);
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 60, 400, 120);

        this.ctx.fillStyle = "#fff";
        this.ctx.textAlign = "center";
        this.ctx.font = "bold 24px 'Outfit', sans-serif";
        this.ctx.fillText("READY TO DROP SOME ADS?", this.canvas.width / 2, this.canvas.height / 2 - 10);
        this.ctx.font = "16px 'Outfit', sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.fillText("CLICK to flap • SPACE to bomb", this.canvas.width / 2, this.canvas.height / 2 + 30);
        
        this.ctx.font = "20px serif";
        this.ctx.textAlign = "right";
        this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.canvas.width - 20, 45);
    }
}

// Global initialization
window.adBirdGame = new AdBird('adBirdCanvas');
