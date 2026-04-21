/**
 * Ad-Bird: Stockout Studio Arcade Engine
 * --------------------------------------
 * V3.3 - Backend Integration Ready (Pass 17)
 */

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

    /* --- INITIALIZATION --- */

    _initSettings(options) {
        this.config = {
            gravity: 0.5, lift: -8, pipeWidth: 110, pipeSpeed: 2.4, bgSpeed: 0.5,
            minGap: 250, maxGap: 350,
            minPipeHeightBottom: 250, minPipeHeightTop: 30,
            bubbleCount: 20, worldShiftInterval: 10, bombCooldown: 20,
            playerImg: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png',
            musicSrc: 'bg-music.mp3', worlds: ['world1.jpg', 'world2.jpg', 'world3.jpg'],
            
            // --- TIERED AD REPOSITORY (CLEANED) ---
            paidAds: options.paidAds || [], // Empty by default, populated by backend fetch
            stockAds: options.stockAds || this._getDefaultStockAds(),
            maxStockConsecutive: 3,
            
            hitMessages: ["WASTED", "REKT", "STAINED", "SPLAT", "GET REKT", "BILLBOARDED", "SIGN SMASHED", "MESSY", "BULLSEYE", "AD-BLASTED", "INKED", "VANDALIZED", "SCORE!", "BIRDPOCALYPSE", "BEAK-TACULAR", "EGG-STERMINATION", "UN-BEAK-ABLE", "FLAPPING SPREE", "WING-SLAUGHTER", "FEATHER-KILL", "DOUBLE BILL", "TRIPLE TWEET", "OVER-FLAP", "BILL-IONAIRE"],
            msgColors: ["#a855f7", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899"],
            gameOverMessages: ["QUARTERLY LOSS", "BRAND DILUTION", "CPC TOO HIGH", "ROAS: ZERO", "CAMPAIGN KILLED", "CLIENT WALKED", "BUDGET BURNED", "IMPRESSIONS LOST", "REACH: DECEASED", "ENGAGEMENT: GRIM", "CTR: DROWNED", "METRICS MASSACRED", "LEAD NOT CONVERTED", "PIPELINE BROKEN", "PERFORMANCE REVIEW", "BIRD DOWN", "FEATHERS EVERYWHERE", "WINGS CLIPPED", "NESTED ETERNAL", "FLEW INTO SIGN", "POOR LIFE CHOICES", "CHICKEN CONFIRMED", "WORM FOOD", "THE SKY WON", "SKILL ISSUE", "GET GUD", "TRY HARDER", "L BOZO", "RATIO'D BY PIPE", "TOUCHED A PIPE", "THE PIPE REMEMBERS", "PIPE: 1, YOU: 0", "PIP INITIATED", "HR INVOLVED", "TERMINATED", "EXIT INTERVIEW", "LINKEDIN UPDATED", "OPEN TO WORK", "SEVERANCE PENDING", "PROJECT CANCELLED", "LIQUIDATED", "BANKRUPTCY", "MARGIN CALLED", "REKT", "STONKS DOWN", "PORTFOLIO: PIPE", "HODL'D TOO LONG", "WHY DID WE FLY", "BIRD WAS A LIE", "NOTHING MATTERS", "THE END", "CERTIFIED DEAD", "LOGGED OFF", "RETURN TO CAVE", "UNSUBSCRIBED FROM LIFE", "404 BIRD", "PRESS F", "GG NO RE", "MAYDAY", "SPLASH", "PIPE DOWN", "OVER-FLAP", "CROP DUSTED", "FLAP DENIED", "WING IT", "PLUMBER'S CRACK", "TALON-TED UNEMPLOYED"],
            readyMessages: [
                "READY TO DROP SOME ADS?", "READY TO RUIN A BRAND?", "READY TO FLAP AROUND?", "READY TO DESTROY COMMERCE?", 
                "READY TO SPLAT SOME SIGNS?", "READY TO BOMB THE MARKET?", "READY TO DEFACE CAPITALISM?", "READY TO VANDALIZE PIPES?", 
                "READY TO HIT SOME BILLBOARDS?", "READY TO DISRUPT ADVERTISING?", "READY TO WING IT?", "READY TO GO VIRAL?", 
                "READY TO MONETIZE CHAOS?", "READY TO MARKET MAYHEM?", "READY TO SCALE HORIZONTALLY?", "READY TO CRUSH YOUR KPIs?", 
                "READY TO MOVE THE NEEDLE?", "READY TO SYNERGIZE?", "READY TO PIVOT DOWNWARD?", "READY TO TANK YOUR METRICS?", 
                "READY TO SHART SOME ADS?", "READY TO POOP ON PROFITS?", "READY TO GREMLIN MAXX?", "READY TO UNHINGE?", 
                "READY TO EMBRACE THE PIPE?", "READY TO BE A BIRD?", "READY TO BIRD THINGS UP?", "READY TO COMMIT CRIMES?", 
                "READY TO BECOME THE PROBLEM?", "READY TO GIVE UP?", "READY TO EAT DIRT?", "READY TO TOUCH A PIPE?", 
                "READY TO LOSE EVERYTHING?", "READY TO DISAPPOINT YOUR PARENTS?", "READY TO QUIT YOUR JOB?", "READY TO RUIN THE FUNNEL?", 
                "READY FOR Q4 LOSSES?", "READY TO GO TO MARKET?", "READY TO LAUNCH?", "READY TO SHIP?", "READY TO TEST IN PROD?", 
                "READY TO FLY INTO THINGS?", "READY TO IGNORE OSHA?", "READY TO BOMB A MEETING?", "READY TO DROP THE BALL?", 
                "READY TO DROP THE BEAT?", "READY TO DROP OUT?", "READY TO DROP AND GIVE ME 20?"
            ]
        };
    }

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
            score: 0, directHits: 0, highScore: parseInt(localStorage.getItem('adBirdHighScore')) || 0,
            highDirectHits: parseInt(localStorage.getItem('adBirdHighDirectHits')) || 0,
            frameCount: 0, nextPipeFrame: 40, currentWorld: 0, flashOpacity: 0, isMuted: false, bgX: 0, screenShake: 0,
            bombTimer: 0, isFullscreen: false, assetsLoaded: 0, lastRect: null, 
            paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], readyMsgBag: [], stockInARow: 0,
            particles: [], deathMsg: "", currentReadyMsg: ""
        };
        this.state.currentReadyMsg = this._nextFromBag('readyMsgBag', 'readyMessages');
        this.player = { x: 250, y: 150, w: 100, h: 100, velocity: 0, flipAngle: 0, isFlipping: false, flipSpeed: 0.25, flipDirection: 1 };
    }

    _initBuffers() {
        this.pipes = []; this.bombs = []; this.bubbles = []; this.floatingTexts = [];
        this.assets = { player: new Image(), worlds: [], music: new Audio(this.config.musicSrc) };
        this.assets.music.loop = true;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    _initEngine() {
        this.assets.player.src = this.config.playerImg;
        this.assets.player.onload = () => this.state.assetsLoaded++;
        this.config.worlds.forEach((p) => { const img = new Image(); img.src = p; img.onload = () => { this.state.assetsLoaded++; if (!this.state.gameRunning) this.drawStartScreen(); }; this.assets.worlds.push(img); });
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
        const flapCodes=['Space','ArrowUp','KeyW','KeyK'], bombCodes=['ShiftLeft','ShiftRight','ArrowDown','KeyS','KeyJ'], flapKeys=[' ','ArrowUp','w','W','k','K'], bombKeys=['Shift','ArrowDown','s','S','j','J'];
        const isFlap = flapCodes.includes(e.code) || flapKeys.includes(e.key), isBomb = bombCodes.includes(e.code) || bombKeys.includes(e.key);
        if (isFlap || isBomb || e.code === 'KeyF' || e.key === 'f' || e.key === 'F') { 
            e.preventDefault(); 
            if (this.state.isGameOver) { this._resetToSplash(); return; }
            if (!this.state.gameRunning) this.start(); 
            else { if (isFlap) this.flap(); if (isBomb) this.dropBomb(); if (e.code==='KeyF'||e.key==='f') this.toggleFullscreen(); } 
        }
    }

    _handleInput(e) {
        if (this.state.isGameOver) { this._resetToSplash(); return; }
        const r = this.state.lastRect || this.canvas.getBoundingClientRect(); const cr = this.canvas.width/this.canvas.height; const sr = r.width/r.height;
        let dw, dh, dx, dy; if (sr > cr) { dh = r.height; dw = dh*cr; dx = (r.width-dw)/2; dy = 0; } else { dw = r.width; dh = dw/cr; dx = 0; dy = (r.height-dh)/2; }
        const x = Math.max(0, Math.min(this.canvas.width, (e.clientX-(r.left+dx))*(this.canvas.width/dw))); const y = Math.max(0, Math.min(this.canvas.height, (e.clientY-(r.top+dy))*(this.canvas.height/dh)));
        if (Math.hypot(x-this.ui.fullscreenBtn.x, y-this.ui.fullscreenBtn.y) < 45+25) { this.toggleFullscreen(); return; }
        if (x > this.canvas.width-80 && y < 120) { this.toggleMute(); return; }
        const b = this.ui.bombBtn; if (x >= b.x-20 && x <= b.x+b.w+20 && y >= b.y-20 && y <= b.y+b.h+20) { if (this.state.gameRunning) this.dropBomb(); else this.start(); return; }
        if (!this.state.gameRunning) this.start(); else { if (e.button === 2) this.dropBomb(); else if (e.button === 0) this.flap(); if (e.preventDefault) e.preventDefault(); }
    }

    /* --- CORE LOOP & PHYSICS --- */

    start() {
        if (this.state.assetsLoaded < this.config.worlds.length + 1) return;
        if (this.overlay) this.overlay.classList.remove('active');
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        Object.assign(this.state, { gameRunning: true, isGameOver: false, score: 0, directHits: 0, frameCount: 0, nextPipeFrame: 40, currentWorld: 0, bgX: 0, screenShake: 0, bombTimer: 0, paidBag: [], stockBag: [], hitMsgBag: [], gameOverMsgBag: [], stockInARow: 0, particles: [] });
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
        requestAnimationFrame(() => this._loop()); 
    }

    _update() {
        if (this.state.screenShake > 0) this.state.screenShake *= 0.9;
        
        if (!this.state.gameRunning) { 
            if (!this.state.isGameOver) {
                // Keep bird at start position during splash
                this.player.y = 150;
                this.player.velocity = 0;
            } else {
                // Apply gravity during death sequence
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
            if (bx < p.x+p.w && bx+bw > p.x && (by < p.y || by+bh > p.y+p.gap)) this.gameOver();
            if (!p.scored && p.x + p.w < this.player.x) { p.scored = true; this.state.score++; this.playSound('score'); if (this.state.score % this.config.worldShiftInterval === 0) this._shiftWorld(); }
            if (p.x + p.w < -150) this.pipes.splice(i, 1);
        }
        for (let i = this.bombs.length - 1; i >= 0; i--) { const b = this.bombs[i]; b.y += b.speed; let hit = false; for (const p of this.pipes) { if (b.x > p.x && b.x < p.x + p.w && (b.y < p.y || b.y > p.y + p.gap)) { this._createSplat(p, b.x, b.y); hit = true; break; } } if (hit || b.y > this.canvas.height) this.bombs.splice(i, 1); }
        this.bubbles.forEach(b => { b.x -= b.speed; if (b.x < -10) b.x = this.canvas.width + 10; });
        for (let i = this.state.particles.length - 1; i >= 0; i--) { const p = this.state.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.02; if (p.life <= 0) this.state.particles.splice(i, 1); }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) { const t = this.floatingTexts[i]; t.age++; if (t.age > 30) { t.vy -= 0.3; t.y += t.vy; t.alpha = Math.max(0, 1 - Math.pow((t.age - 30) / 40, 2)); } if (t.alpha <= 0 || t.age > 70) this.floatingTexts.splice(i, 1); }
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
            const gc = p.ad.color; const bW = 3; const capH = 18;
            this.ctx.fillStyle = "rgba(10, 10, 15, 0.95)"; this.ctx.fillRect(p.x, 0, p.w, p.y); this.ctx.fillRect(p.x, p.y+p.gap, p.w, this.canvas.height); 
            this.ctx.fillStyle = gc; this.ctx.fillRect(p.x-bW, 0, bW, p.y); this.ctx.fillRect(p.x+p.w, 0, bW, p.y); this.ctx.fillRect(p.x-bW, p.y+p.gap, bW, this.canvas.height); this.ctx.fillRect(p.x+p.w, p.y+p.gap, bW, this.canvas.height);
            this.ctx.save(); this.ctx.shadowBlur = 20; this.ctx.shadowColor = gc; this.ctx.fillStyle = gc; this.ctx.fillRect(p.x-bW, p.y-capH, p.w+(bW*2), capH); this.ctx.fillRect(p.x-bW, p.y+p.gap, p.w+(bW*2), capH);
            const ph = (Math.sin(this.state.frameCount*0.05)+1)/2; const lo = 2+(ph*(capH-6)); this.ctx.fillStyle = "rgba(255,255,255,0.9)"; this.ctx.shadowBlur = 10; this.ctx.shadowColor = "#fff";
            this.ctx.fillRect(p.x-bW, p.y-capH+lo, p.w+(bW*2), 2); this.ctx.fillRect(p.x-bW, p.y+p.gap+lo, p.w+(bW*2), 2); this.ctx.restore();
            [0, p.y+p.gap].forEach(sy => { this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(p.x-bW, sy, p.w+(bW*2), sy===0?p.y:this.canvas.height); this.ctx.clip(); p.stains.forEach(s => { this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; this.ctx.beginPath(); this.ctx.arc(p.x+s.xOff, s.relY, s.size, 0, Math.PI*2); this.ctx.fill(); s.drips.forEach(d => { this.ctx.beginPath(); this.ctx.roundRect(p.x+s.xOff+d.xOff, s.relY, d.w, d.len, d.w/2); this.ctx.fill(); }); }); this.ctx.restore(); });
            this.ctx.save(); this.ctx.translate(p.x+p.w/2, p.y+p.gap+(this.canvas.height-(p.y+p.gap))/2); this.ctx.rotate(-Math.PI/2); this.ctx.fillStyle = "#fff"; this.ctx.font = "bold 20px 'Outfit', sans-serif"; this.ctx.textAlign = "center"; this.ctx.shadowColor = gc; this.ctx.shadowBlur = 12; this.ctx.fillText(p.ad.text, 0, 0); this.ctx.restore();
        });
    }

    _renderHUD() {
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "alphabetic"; this.ctx.font = "bold 48px 'Outfit', sans-serif"; this.ctx.fillText(this.state.score, this.ui.scoreCenter, 65);
        this.ctx.font = "bold 14px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; this.ctx.fillText(`MARKETING IMPACT: ${this.state.directHits}`, this.ui.scoreCenter, 90);
        this.ctx.font = "24px serif"; this.ctx.textAlign = "right"; this.ctx.fillText(this.state.isMuted ? "🔇" : "🔊", this.ui.muteBtn.x, this.ui.muteBtn.y);
        const fs = this.ui.fullscreenBtn; this.ctx.save(); this.ctx.fillStyle = "rgba(10, 10, 15, 0.6)"; this.ctx.beginPath(); this.ctx.arc(fs.x, fs.y, fs.radius, 0, Math.PI * 2); this.ctx.fill(); this.ctx.font = "bold 54px serif"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; this.ctx.fillText("⤢", fs.x, fs.y + 4); this.ctx.restore();
        const b = this.ui.bombBtn; this.ctx.save(); this.ctx.fillStyle = this.state.bombTimer > 0 ? "rgba(255, 255, 255, 0.15)" : "rgba(6, 182, 212, 0.6)"; this.ctx.shadowBlur = 15; this.ctx.shadowColor = "#06b6d4"; this.ctx.beginPath(); this.ctx.roundRect(b.x, b.y, b.w, b.h, b.radius); this.ctx.fill();
        this.ctx.fillStyle = "#fff"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.font = "bold 32px 'Outfit', sans-serif"; this.ctx.shadowBlur = 0; this.ctx.fillText("BOMB", b.x + b.w/2, b.y + b.h/2 - (this.isMobile ? 0 : 8)); 
        if (!this.isMobile) { this.ctx.font = "bold 11px 'Outfit', sans-serif"; this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; this.ctx.fillText("(SHIFT / R-CLICK)", b.x + b.w/2, b.y + b.h/2 + 22); } 
        if (this.state.bombTimer > 0) { this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; this.ctx.fillRect(b.x, b.y + b.h - 4, b.w * (this.state.bombTimer / 20), 4); } this.ctx.restore();
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

    _createSplat(p, bx, by) { 
        this.state.screenShake = 10; this.state.directHits++; this.player.isFlipping = true; this.player.flipAngle = 0; for (let i=0; i<15; i++) this.state.particles.push({ x: bx, y: by, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10-2, color: p.ad.color, life: 1.0 }); p.stains.push({ relY: by, xOff: bx-p.x, size: Math.random()*8+12, drips: Array.from({length:3},()=>({xOff:(Math.random()-0.5)*20,len:0,maxLen:40+Math.random()*60,speed:1.0+Math.random()*1.5,w:3+Math.random()*4})) }); let sy = by-40; this.floatingTexts.forEach(t => { if (Math.abs(t.x-bx)<50 && Math.abs(t.y-sy)<30) sy-=40; }); 
        const hitMsg = this._nextFromBag('hitMsgBag', 'hitMessages');
        this.floatingTexts.push({ x: bx, y: sy, age: 0, vy: 0, alpha: 1, scale: 1, text: hitMsg, color: this.config.msgColors[Math.floor(Math.random()*this.config.msgColors.length)] }); 
        this.playSound('splat'); 
    }

    gameOver() { 
        if (this.state.isGameOver) return; this.state.isGameOver = true; this.state.screenShake = 20; this.state.gameRunning = false; 
        this.state.deathMsg = this._nextFromBag('gameOverMsgBag', 'gameOverMessages');
        this.playSound('crash'); setTimeout(() => this.playSound('death'), 300); if (this.assets.music) this.assets.music.pause(); if (this.state.score > this.state.highScore) { this.state.highScore = this.state.score; localStorage.setItem('adBirdHighScore', this.state.highScore); } if (this.state.directHits > this.state.highDirectHits) { this.state.directHits = this.state.directHits; localStorage.setItem('adBirdHighDirectHits', this.state.directHits); } if (this.isMobile && this.overlay) this.overlay.classList.add('active'); 
    }

    /* --- HELPERS --- */

    playSound(type) { if (this.state.isMuted) return; const n = this.audioCtx.currentTime; if (type === 'splat') { const o = this.audioCtx.createOscillator(); const g = this.audioCtx.createGain(); o.connect(g); g.connect(this.audioCtx.destination); o.type = 'square'; o.frequency.setValueAtTime(400, n); o.frequency.exponentialRampToValueAtTime(800, n+0.1); g.gain.setValueAtTime(0.3, n); g.gain.exponentialRampToValueAtTime(0.01, n+0.15); o.start(n); o.stop(n+0.15); return; } if (type === 'death') { [392, 311, 261].forEach((f, i) => { const o = this.audioCtx.createOscillator(); const g = this.audioCtx.createGain(); o.connect(g); g.connect(this.audioCtx.destination); o.type = 'triangle'; const st = n + (i*0.15); o.frequency.setValueAtTime(f, st); o.frequency.exponentialRampToValueAtTime(f*0.8, st+0.4); g.gain.setValueAtTime(0.3, st); g.gain.exponentialRampToValueAtTime(0.01, st+0.4); o.start(st); o.stop(st+0.4); }); return; } const sounds = { flap: { type: 'square', freq: [150, 400], vol: 0.5, dur: 0.1 }, score: { type: 'sine', freq: [800, 1200], vol: 0.4, dur: 0.1 }, crash: { type: 'sawtooth', freq: [100, 20], vol: 0.6, dur: 0.5 }, shift: { type: 'square', freq: [200, 800], vol: 0.5, dur: 0.3 } }; const s = sounds[type]; const o = this.audioCtx.createOscillator(); const g = this.audioCtx.createGain(); o.connect(g); g.connect(this.audioCtx.destination); o.type = s.type; o.frequency.setValueAtTime(s.freq[0], n); o.frequency.exponentialRampToValueAtTime(s.freq[1], n+s.dur); g.gain.setValueAtTime(s.vol, n); g.gain.exponentialRampToValueAtTime(0.01, n+s.dur); o.start(n); o.stop(n+s.dur); }
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
    dropBomb() { if (this.state.bombTimer > 0) return; this.bombs.push({ x: this.player.x+this.player.w/2, y: this.player.y+this.player.h-10, w: 15, h: 20, speed: 8 }); this.state.bombTimer = 20; }
    _renderWorld() { const bg = this.assets.worlds[this.state.currentWorld]; if (bg && bg.complete) { const rx = Math.floor(this.state.bgX); this.ctx.drawImage(bg, rx, 0, this.canvas.width+2, this.canvas.height); this.ctx.drawImage(bg, rx + this.canvas.width, 0, this.canvas.width+2, this.canvas.height); } if (this.state.flashOpacity > 0) { this.ctx.fillStyle = `rgba(255, 255, 255, ${this.state.flashOpacity})`; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.state.flashOpacity -= 0.05; } }
    _renderBubbles() { this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; this.bubbles.forEach(b => { this.ctx.beginPath(); this.ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); this.ctx.fill(); }); }
    _renderBombs() { this.ctx.fillStyle = "#fff"; this.bombs.forEach(b => { this.ctx.beginPath(); this.ctx.ellipse(b.x, b.y, b.w/2, b.h/2, 0, 0, Math.PI*2); this.ctx.fill(); }); }
    _renderPlayer() { this.ctx.save(); this.ctx.translate(this.player.x+this.player.w/2, this.player.y+this.player.h/2); this.ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/4, this.player.velocity*0.05)) + this.player.flipAngle); this.ctx.scale(-1, 1); this.ctx.drawImage(this.assets.player, -this.player.w/2, -this.player.h/2, this.player.w, this.player.h); this.ctx.restore(); }
    _renderParticles() { this.state.particles.forEach(p => { this.ctx.globalAlpha = p.life; this.ctx.fillStyle = p.color; this.ctx.shadowBlur = 10; this.ctx.shadowColor = p.color; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 3, 0, Math.PI*2); this.ctx.fill(); }); this.ctx.globalAlpha = 1; this.ctx.shadowBlur = 0; }
    _renderFloatingTexts() { this.ctx.textAlign = "center"; this.floatingTexts.forEach(t => { this.ctx.save(); this.ctx.globalAlpha = t.alpha; this.ctx.translate(t.x, t.y); this.ctx.scale(t.scale, t.scale); this.ctx.font = "bold 36px 'Outfit', sans-serif"; this.ctx.strokeStyle = "#000"; this.ctx.lineWidth = 1.5; this.ctx.strokeText(t.text, 0, 0); this.ctx.fillStyle = t.color; this.ctx.shadowBlur = 15; this.ctx.shadowColor = t.color; this.ctx.fillText(t.text, 0, 0); this.ctx.restore(); }); }
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
        
        // --- CLEAN SLATE ---
        this.pipes = [];
        this.bombs = [];
        this.floatingTexts = [];
        
        // --- THE RESET BLAST ---
        this.state.screenShake = 15;
        this.state.flashOpacity = 1;
        this.playSound('shift');
        
        // Explode a burst of neon particles from the center
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
    _setupHiDPI() { const dpr = window.devicePixelRatio || 1; if (dpr > 1) { const lw = this.canvas.width; const lh = this.canvas.height; this.canvas.width = lw * dpr; this.canvas.height = lh * dpr; this.ctx.scale(dpr, dpr); Object.defineProperty(this.canvas, 'width', { get: () => lw, configurable: true }); Object.defineProperty(this.canvas, 'height', { get: () => lh, configurable: true }); } this.canvas.style.touchAction = 'none'; this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
    _renderOverlay() { 
        this._renderHUD(); 
        if (this.state.isGameOver) this._renderGameOverScreen(); 
        else if (!this.state.gameRunning) this._renderStartScreen();
    }
    _initBubbles() { this.bubbles = Array.from({ length: 20 }, () => ({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, size: Math.random() * 3 + 1, speed: Math.random() * 0.5 + 0.2 })); }
    _getDefaultStockAds() { return [{ text: "YOUR AD HERE", color: "#4ade80" }, { text: "BUY THIS PIPE", color: "#f59e0b" }, { text: "RENT ME $5", color: "#06b6d4" }, { text: "SPONSORED", color: "#a855f7" }, { text: "AD SLOT OPEN", color: "#4ade80" }, { text: "SEO LIVES HERE", color: "#94a3b8" }, { text: "CPC: $0.04", color: "#22c55e" }, { text: "IMPRESSIONS++", color: "#ec4899" }, { text: "SPOT VACANT", color: "#f8fafc" }, { text: "BIG PIPE CO", color: "#4ade80" }, { text: "PIPES.IO", color: "#06b6d4" }, { text: "FLAP & CO", color: "#f59e0b" }, { text: "PIPE DEPOT", color: "#a855f7" }, { text: "DUCTMART", color: "#4ade80" }, { text: "TUBE & SON", color: "#06b6d4" }, { text: "WE'RE HIRING", color: "#22c55e" }, { text: "PIPES AS A SERVICE", color: "#06b6d4" }, { text: "SERIES A PIPE", color: "#f59e0b" }, { text: "DISRUPT PIPES", color: "#a855f7" }, { text: "GO PUBLIC SOON", color: "#ec4899" }, { text: "PIPE TO THE MOON", color: "#4ade80" }, { text: "WEB3 PIPE", color: "#06b6d4" }, { text: "DON'T BOMB ME", color: "#f43f5e" }, { text: "PLEASE NO", color: "#f43f5e" }, { text: "AVOID THIS PIPE", color: "#f59e0b" }, { text: "NOT A BILLBOARD", color: "#94a3b8" }, { text: "DUCK!", color: "#f59e0b" }, { text: "INCOMING", color: "#f43f5e" }, { text: "OUCH", color: "#f43f5e" }, { text: "RIP THIS PIPE", color: "#94a3b8" }, { text: "I HAVE A FAMILY", color: "#ec4899" }, { text: "BUY BITCOIN", color: "#f59e0b" }, { text: "HODL", color: "#f59e0b" }, { text: "DIAMOND PIPES", color: "#06b6d4" }, { text: "PIPE ETF", color: "#4ade80" }, { text: "SHORT THE BIRD", color: "#f43f5e" }, { text: "LONG ON GUANO", color: "#22c55e" }, { text: "ROTH IRAPIPE", color: "#a855f7" }, { text: "PIPE DREAMS", color: "#06b6d4" }, { text: "PIPELINE FULL", color: "#a855f7" }, { text: "PIPE ME UP", color: "#4ade80" }, { text: "DOWN THE PIPE", color: "#f59e0b" }, { text: "PIPE IT UP", color: "#ec4899" }, { text: "HOT PIPE", color: "#f43f5e" }, { text: "DRAIN PIPE 9", color: "#06b6d4" }, { text: "CLOG FREE", color: "#22c55e" }, { text: "FLY AWAY BIRD", color: "#94a3b8" }, { text: "NEST ELSEWHERE", color: "#94a3b8" }, { text: "BIRD-PROOF", color: "#f43f5e" }, { text: "ANTI-BIRD", color: "#f43f5e" }, { text: "NO BIRDS ALLOWED", color: "#f43f5e" }, { text: "BEAK OFF", color: "#a855f7" }, { text: "BIRD REPELLENT", color: "#22c55e" }, { text: "TALON-TESTED", color: "#06b6d4" }, { text: "EGGS ON SALE", color: "#f59e0b" }, { text: "FREE WI-FI", color: "#4ade80" }, { text: "CALL YOUR MOM", color: "#ec4899" }, { text: "MISS YOU MOM", color: "#ec4899" }, { text: "HI MOM", color: "#ec4899" }, { text: "THIS IS FINE", color: "#f59e0b" }, { text: "LIVE LAUGH LOVE", color: "#ec4899" }, { text: "NAMASTE", color: "#06b6d4" }, { text: "TOUCH GRASS", color: "#22c55e" }, { text: "VISIT MY SITE", color: "#06b6d4" }, { text: "DM FOR RATES", color: "#a855f7" }, { text: "LINK IN BEAK", color: "#4ade80" }, { text: "1-800-PIPE", color: "#f59e0b" }, { text: "TAP TO CALL", color: "#4ade80" }, { text: "WHY AM I HERE", color: "#94a3b8" }, { text: "WHAT IS PIPE", color: "#94a3b8" }, { text: "AM I REAL", color: "#94a3b8" }, { text: "HELP", color: "#f43f5e" }, { text: "I SEE YOU", color: "#ec4899" }, { text: "GOODBYE WORLD", color: "#94a3b8" }, { text: "SEND HELP", color: "#f43f5e" }, { text: "THE END IS PIPE", color: "#a855f7" }]; }
}

// Global Init
document.addEventListener('DOMContentLoaded', () => {
    const t = document.getElementById('mobileMenuToggle'); const n = document.getElementById('navLinks');
    if (t && n) { 
        t.onclick=(e)=>{
            e.stopPropagation(); 
            n.classList.toggle('active');
            t.classList.toggle('active');
        }; 
        document.addEventListener('click',()=>{
            n.classList.remove('active');
            t.classList.remove('active');
        }); 
        n.onclick=(e)=>e.stopPropagation(); 
    }
    
    // SUPABASE / BACKEND INTEGRATION HOOK
    const initGame = async () => {
        let paidAds = [];
        
        // --- CONFIGURATION ---
        const SUPABASE_URL = 'https://agbtvbymknayxrebochn.supabase.co'; 
        const SUPABASE_KEY = 'sb_publishable_8yipwhYLiM19LVR8qLXT6A_MOD1YTl1';
        
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/ads?select=text&is_paid=eq.true&status=eq.approved&expires_at=gt.now()`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Assign a random vibrant color from our config to each ad
                const colors = ['#a855f7', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899'];
                paidAds = data.map(ad => ({ 
                    ...ad, 
                    isPaid: true, 
                    color: colors[Math.floor(Math.random() * colors.length)] 
                }));
                console.log(`Backend Hook: ${paidAds.length} Paid Ads Loaded.`);
            }
        } catch (e) {
            console.warn("Backend unavailable or not configured, using stock ads only.");
        }
        
        window.adBirdGame = new AdBird('adBirdCanvas', { paidAds });
    };

    setTimeout(initGame, 100);
});
