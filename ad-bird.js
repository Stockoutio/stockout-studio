/**
 * Ad-Bird: Stockout Studio Edition
 * A high-performance, billboard-smashing arcade experience.
 */

class AdBird {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Game Settings
        this.config = {
            gravity: 0.5,
            lift: -8,
            pipeWidth: 80,
            pipeGap: 200,
            pipeSpeed: 2.2,
            bgSpeed: 0.5,
            bubbleCount: 20,
            worldShiftInterval: 10
        };

        // Assets
        this.assets = {
            player: new Image(),
            worlds: [new Image(), new Image(), new Image()],
            music: document.getElementById('bgMusic')
        };
        
        // State
        this.state = {
            gameRunning: false,
            score: 0,
            frameCount: 0,
            nextPipeFrame: 40,
            currentWorld: 0,
            lastMilestone: 0,
            flashOpacity: 0,
            isMuted: false
        };

        this.player = { x: 50, y: 150, w: 60, h: 60, velocity: 0 };
        this.pipes = [];
        this.bombs = [];
        this.bubbles = [];
        this.ads = [
            { text: "YOUR AD HERE", color: "#4ade80" },
            { text: "BUY BITCOIN", color: "#f59e0b" },
            { text: "FOLLOW ME", color: "#06b6d4" }
        ];

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.init();
    }

    init() {
        // Load Assets
        this.assets.player.src = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png'; // Bird
        const worldPaths = ['world1.jpg', 'world2.jpg', 'world3.jpg'];
        worldPaths.forEach((path, i) => this.assets.worlds[i].src = path);

        // Bind Events
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.state.gameRunning) this.start();
                else this.dropBomb();
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Mute Button Hitbox
            if (x > this.canvas.width - 60 && y < 60) {
                this.toggleMute();
                return;
            }

            if (!this.state.gameRunning) this.start();
            else this.flap();
        });

        // Initial Render
        this.initBubbles();
        setTimeout(() => this.drawStartScreen(), 100);
    }

    initBubbles() {
        this.bubbles = Array.from({ length: this.config.bubbleCount }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 1 + 1
        }));
    }

    start() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.state.gameRunning = true;
        this.state.score = 0;
        this.state.frameCount = 0;
        this.state.nextPipeFrame = 40;
        this.state.currentWorld = 0;
        this.state.lastMilestone = 0;
        this.player.y = 150;
        this.player.velocity = 0;
        this.pipes = [];
        this.bombs = [];
        this.bgX = 0;

        if (this.assets.music && !this.state.isMuted) {
            this.assets.music.currentTime = 0;
            this.assets.music.volume = 1.0;
            this.assets.music.play();
        }

        this.loop();
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

    update() {
        if (!this.state.gameRunning) return;

        // Background
        this.bgX = (this.bgX - this.config.bgSpeed) % this.canvas.width;

        // Player
        this.player.velocity += this.config.gravity;
        this.player.y += this.player.velocity;

        // Pipes
        if (this.state.frameCount >= this.state.nextPipeFrame) {
            this.spawnPipe();
        }

        this.updatePipes();
        this.updateBombs();
        this.updateBubbles();

        if (this.player.y + this.player.h > this.canvas.height || this.player.y < 0) {
            this.gameOver();
        }

        this.state.frameCount++;
    }

    spawnPipe() {
        const h = Math.floor(Math.random() * (this.canvas.height - this.config.pipeGap - 120)) + 60;
        this.pipes.push({
            x: this.canvas.width,
            y: h,
            w: this.config.pipeWidth,
            gap: this.config.pipeGap,
            ad: this.ads[Math.floor(Math.random() * this.ads.length)],
            scored: false,
            stains: []
        });
        this.state.nextPipeFrame = this.state.frameCount + Math.floor(Math.random() * 50) + 100;
    }

    updatePipes() {
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            p.x -= this.config.pipeSpeed;

            // Collision
            if (this.player.x + 15 < p.x + p.w && this.player.x + this.player.w - 15 > p.x &&
                (this.player.y + 15 < p.y || this.player.y + this.player.h - 15 > p.y + p.gap)) {
                this.gameOver();
            }

            // Score
            if (!p.scored && p.x + p.w < this.player.x) {
                p.scored = true;
                this.state.score++;
                this.playSound('score');
                if (this.state.score % this.config.worldShiftInterval === 0) {
                    this.shiftWorld();
                }
            }

            if (p.x + p.w < 0) this.pipes.splice(i, 1);
        }
    }

    updateBombs() {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const b = this.bombs[i];
            b.y += b.speed;
            
            let hit = false;
            this.pipes.forEach(p => {
                const hitTop = b.x > p.x && b.x < p.x + p.w && b.y < p.y;
                const hitBottom = b.x > p.x && b.x < p.x + p.w && b.y > p.y + p.gap;
                if (hitTop || hitBottom) {
                    p.stains.push({ relY: b.y, xOff: b.x - p.x, size: Math.random() * 10 + 10 });
                    this.playSound('splat');
                    hit = true;
                }
            });

            if (hit || b.y > this.canvas.height) this.bombs.splice(i, 1);
        }
    }

    updateBubbles() {
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

    draw() {
        const { ctx, canvas, state, player, pipes, bombs, bubbles, assets } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // BG
        const bg = assets.worlds[state.currentWorld];
        if (bg.complete) {
            const rx = Math.floor(this.bgX);
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
            ctx.strokeRect(p.x, -10, p.w, p.y + 10);
            ctx.fillRect(p.x, p.y + p.gap, p.w, canvas.height);
            ctx.strokeRect(p.x, p.y + p.gap, p.w, canvas.height + 10);

            p.stains.forEach(s => {
                ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                ctx.beginPath();
                ctx.arc(p.x + s.xOff, s.relY, s.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(p.x + s.xOff - 2, s.relY, 4, 15);
            });

            // Ad Text
            const adY = p.y < 100 ? (p.y + p.gap + (canvas.height - (p.y + p.gap)) / 2) : p.y / 2;
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
        ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, player.velocity * 0.1)));
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

    loop() {
        this.update();
        this.draw();
        if (this.state.gameRunning) requestAnimationFrame(() => this.loop());
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
        if (bg.complete) this.ctx.drawImage(bg, 0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = "#fff";
        this.ctx.textAlign = "center";
        this.ctx.font = "bold 24px 'Outfit', sans-serif";
        this.ctx.fillText("READY TO DROP SOME ADS?", this.canvas.width / 2, this.canvas.height / 2 - 20);
        this.ctx.font = "16px 'Outfit', sans-serif";
        this.ctx.fillStyle = "rgba(255,255,255,0.7)";
        this.ctx.fillText("CLICK to flap • SPACE to bomb", this.canvas.width / 2, this.canvas.height / 2 + 30);
        this.ctx.font = "22px serif";
        this.ctx.textAlign = "right";
        this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.canvas.width - 20, 45);
    }
}

// Start Game
const game = new AdBird('adBirdCanvas');
