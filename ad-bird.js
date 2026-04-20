const canvas = document.getElementById('adBirdCanvas');
const ctx = canvas.getContext('2d');

// Load Google Noto Bird Asset
const birdImg = new Image();
birdImg.src = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f426.png';

let bird = { x: 50, y: 150, width: 38, height: 38, gravity: 0.6, lift: -10, velocity: 0 };
let pipes = [];
let frameCount = 0;
let score = 0;
let gameRunning = false;

const ads = [
    { text: "YOUR AD HERE", color: "#8b5cf6" },
    { text: "BUY BITCOIN", color: "#f59e0b" },
    { text: "FOLLOW ME", color: "#06b6d4" }
];

function initGame() {
    bird.y = 150;
    bird.velocity = 0;
    pipes = [];
    score = 0;
    frameCount = 0;
    gameRunning = true;
    requestAnimationFrame(update);
}

let nextPipeFrame = 100;

function update() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Bird Logic & Rendering
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    ctx.save();
    ctx.translate(bird.x + bird.width/2, bird.y + bird.height/2);
    
    // Rotate bird based on velocity
    let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.1));
    ctx.rotate(rotation);
    
    // Flip horizontally so he faces right
    ctx.scale(-1, 1);
    
    // Draw the Google Bird
    ctx.drawImage(birdImg, -bird.width/2, -bird.height/2, bird.width, bird.height);
    ctx.restore();

    // Pipe Logic
    if (frameCount >= nextPipeFrame) {
        let gap = 160; // Wider gap for easier play
        let minPipeHeight = 80; // Minimum height for ads to show clearly
        let pipeHeight = Math.floor(Math.random() * (canvas.height - gap - (minPipeHeight * 2))) + minPipeHeight;
        
        pipes.push({ 
            x: canvas.width, 
            y: pipeHeight, 
            width: 80, 
            gap: gap, 
            ad: ads[Math.floor(Math.random() * ads.length)] 
        });
        
        // Randomize distance to next pipe (120 to 200 frames)
        nextPipeFrame = frameCount + Math.floor(Math.random() * 80) + 120;
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= 2.5;

        // Draw Pipes (Billboards)
        ctx.fillStyle = "#1a1a1e";
        ctx.strokeStyle = pipes[i].ad.color;
        ctx.lineWidth = 3;
        
        ctx.fillRect(pipes[i].x, 0, pipes[i].width, pipes[i].y);
        ctx.strokeRect(pipes[i].x, 0, pipes[i].width, pipes[i].y);
        
        ctx.fillRect(pipes[i].x, pipes[i].y + pipes[i].gap, pipes[i].width, canvas.height);
        ctx.strokeRect(pipes[i].x, pipes[i].y + pipes[i].gap, pipes[i].width, canvas.height);

        // Ad Text
        ctx.save();
        ctx.translate(pipes[i].x + pipes[i].width/2, pipes[i].y / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(pipes[i].ad.text, 0, 0);
        ctx.restore();

        // Collision
        if (bird.x < pipes[i].x + pipes[i].width &&
            bird.x + bird.width > pipes[i].x &&
            (bird.y < pipes[i].y || bird.y + bird.height > pipes[i].y + pipes[i].gap)) {
            gameOver();
        }

        if (pipes[i].x + pipes[i].width < 0) {
            pipes.splice(i, 1);
            score++;
        }
    }

    // Score Counter (HUD)
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px 'Outfit', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(score, 20, 40);

    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameOver();
    }

    frameCount++;
    requestAnimationFrame(update);
}

function gameOver() {
    gameRunning = false;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AD-BIRD DOWN", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "18px 'Outfit', sans-serif";
    ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px 'Outfit', sans-serif";
    ctx.fillText("Click to try again", canvas.width / 2, canvas.height / 2 + 50);
}

canvas.addEventListener('mousedown', () => {
    if (!gameRunning) {
        initGame();
    } else {
        bird.velocity = bird.lift;
    }
});

// Start screen
birdImg.onload = () => {
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 16px 'Outfit', sans-serif";
    ctx.fillText("CLICK TO START FLAPPING", canvas.width / 2, canvas.height / 2);
};
