const canvas = document.getElementById('adBirdCanvas');
const ctx = canvas.getContext('2d');

// --- Assets ---
const birdImg = new Image();
birdImg.src = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png';

// --- World Rotation ---
const worldPaths = ['world1.jpg', 'world2.jpg', 'world3.jpg'];
let worldImages = [];
let currentWorldIndex = 0;
let flashOpacity = 0;
let lastMilestone = 0;

worldPaths.forEach(path => {
    const img = new Image();
    img.src = path;
    worldImages.push(img);
});

// --- Parallax State ---
let bgX = 0;
let bubbles = [];

function initBubbles() {
    bubbles = [];
    for (let i = 0; i < 20; i++) {
        bubbles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 1 + 1 
        });
    }
}

// --- Audio Synth Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!window.isPlaying) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'flap') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.5, now); // Down by 0.1
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'score') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.5, now); // Down by 0.1
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(20, now + 0.5);
        gain.gain.setValueAtTime(0.7, now); // Down by 0.1
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'shift') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.6, now); // Down by 0.1
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

let bird = { x: 50, y: 150, width: 34, height: 34, gravity: 0.5, lift: -7, velocity: 0 };
let pipes = [];
let frameCount = 0;
let score = 0;
let gameRunning = false;
let nextPipeFrame = 40;

const ads = [
    { text: "YOUR AD HERE", color: "#4ade80" },
    { text: "BUY BITCOIN", color: "#22d3ee" },
    { text: "FOLLOW ME", color: "#818cf8" }
];

function initGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    bird.y = 150;
    bird.velocity = 0;
    pipes = [];
    score = 0;
    lastMilestone = 0;
    currentWorldIndex = 0;
    frameCount = 0;
    nextPipeFrame = 40;
    bgX = 0;
    flashOpacity = 0;
    initBubbles();
    gameRunning = true;
    
    if (!window.music) window.music = document.getElementById('bgMusic');
    if (window.music && window.isPlaying) {
        window.music.currentTime = 0;
            window.music.volume = 1.0;
        window.music.play().catch(e => console.log("Audio waiting for interaction"));
    }
    
    requestAnimationFrame(update);
}

function update() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Background
    bgX -= 0.5;
    if (bgX <= -canvas.width) bgX = 0;
    
    let activeBG = worldImages[currentWorldIndex];
    if (activeBG && activeBG.complete && activeBG.naturalWidth !== 0) {
        let roundedX = Math.floor(bgX);
        ctx.drawImage(activeBG, roundedX, 0, canvas.width + 2, canvas.height);
        ctx.drawImage(activeBG, roundedX + canvas.width, 0, canvas.width + 2, canvas.height);
    } else {
        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw Midground Bubbles
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    bubbles.forEach(bubble => {
        bubble.x -= bubble.speed;
        if (bubble.x < -10) bubble.x = canvas.width + 10;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // 3. Bird Logic
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    ctx.save();
    ctx.translate(bird.x + bird.width/2, bird.y + bird.height/2);
    let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.1));
    ctx.rotate(rotation);
    ctx.scale(-1, 1);
    ctx.drawImage(birdImg, -bird.width/2, -bird.height/2, bird.width, bird.height);
    ctx.restore();

    // 4. Pipe Logic
    if (frameCount >= nextPipeFrame) {
        let gap = 200; 
        let minPipeHeight = 60;
        let pipeHeight = Math.floor(Math.random() * (canvas.height - gap - (minPipeHeight * 2))) + minPipeHeight;
        
        pipes.push({ 
            x: canvas.width, 
            y: pipeHeight, 
            width: 80, 
            gap: gap, 
            ad: ads[Math.floor(Math.random() * ads.length)],
            scored: false
        });
        
        nextPipeFrame = frameCount + Math.floor(Math.random() * 50) + 100;
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= 2.2; 

        ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
        ctx.strokeStyle = pipes[i].ad.color;
        ctx.lineWidth = 4;
        ctx.fillRect(pipes[i].x, 0, pipes[i].width, pipes[i].y);
        ctx.strokeRect(pipes[i].x, -10, pipes[i].width, pipes[i].y + 10);
        ctx.fillRect(pipes[i].x, pipes[i].y + pipes[i].gap, pipes[i].width, canvas.height);
        ctx.strokeRect(pipes[i].x, pipes[i].y + pipes[i].gap, pipes[i].width, canvas.height + 10);

        let adY = pipes[i].y < 100 ? (pipes[i].y + pipes[i].gap + (canvas.height - (pipes[i].y + pipes[i].gap)) / 2) : pipes[i].y / 2;
        ctx.save();
        ctx.translate(pipes[i].x + pipes[i].width/2, adY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = pipes[i].ad.color;
        ctx.shadowBlur = 10;
        ctx.fillText(pipes[i].ad.text, 0, 0);
        ctx.restore();

        if (bird.x + 5 < pipes[i].x + pipes[i].width &&
            bird.x + bird.width - 5 > pipes[i].x &&
            (bird.y + 5 < pipes[i].y || bird.y + bird.height - 5 > pipes[i].y + pipes[i].gap)) {
            gameOver();
        }

        if (!pipes[i].scored && pipes[i].x + pipes[i].width < bird.x) {
            pipes[i].scored = true;
            score++;
            playSound('score');
            
            if (score > 0 && score % 10 === 0 && score !== lastMilestone) {
                lastMilestone = score;
                currentWorldIndex = (currentWorldIndex + 1) % worldImages.length;
                flashOpacity = 1; 
                playSound('shift');
            }
        }

        if (pipes[i].x + pipes[i].width < 0) {
            pipes.splice(i, 1);
        }
    }

    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px 'Outfit', sans-serif";
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;
    ctx.fillText(score, 25, 45);

    ctx.font = "22px serif";
    ctx.textAlign = "right";
    ctx.fillText(window.isPlaying ? "🔊" : "🔇", canvas.width - 20, 45);

    if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashOpacity -= 0.05; 
    }

    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameOver();
    }

    frameCount++;
    requestAnimationFrame(update);
}

function gameOver() {
    if (gameRunning) playSound('crash');
    gameRunning = false;
    pipes = [];
    if (window.music) window.music.pause();

    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AD-BIRD LOST AT SEA", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "20px 'Outfit', sans-serif";
    ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2 + 25);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px 'Outfit', sans-serif";
    ctx.fillText("Click to respawn", canvas.width / 2, canvas.height / 2 + 60);
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (x > canvas.width - 60 && y < 60) {
        window.isPlaying = !window.isPlaying;
        if (!window.isPlaying && window.music) window.music.pause();
        if (window.isPlaying && gameRunning && window.music) {
            window.music.volume = 1.0;
            window.music.play();
        }
        return;
    }

    if (!gameRunning) {
        initGame();
    } else {
        bird.velocity = bird.lift;
        playSound('flap');
    }
});

function renderStartScreen() {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let activeBG = worldImages[currentWorldIndex];
    if (activeBG && activeBG.complete && activeBG.naturalWidth !== 0) {
        ctx.drawImage(activeBG, 0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 18px 'Outfit', sans-serif";
    ctx.shadowBlur = 10;
    ctx.fillText("CLICK TO START FLAPPING", canvas.width / 2, canvas.height / 2);
    ctx.font = "22px serif";
    ctx.textAlign = "right";
    ctx.fillText(window.isPlaying ? "🔊" : "🔇", canvas.width - 20, 45);
}

let loadedCount = 0;
worldImages.forEach(img => {
    img.onload = () => {
        loadedCount++;
        if (loadedCount === worldImages.length) renderStartScreen();
    };
});
