const canvas = document.getElementById('adBirdCanvas');
const ctx = canvas.getContext('2d');

let bird = { x: 50, y: 150, width: 34, height: 34, gravity: 0.6, lift: -10, velocity: 0 };
let pipes = [];
let frameCount = 0;
let score = 0;
let gameRunning = false;

// Example "Ads" - in a real version, these would be URLs from a database
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
    
    ctx.font = `${bird.width}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🐦", 0, 0);
    ctx.restore();

    // Pipe Logic
    if (frameCount % 100 === 0) {
        let gap = 100;
        let pipeHeight = Math.floor(Math.random() * (canvas.height - gap));
        pipes.push({ 
            x: canvas.width, 
            y: pipeHeight, 
            width: 60, 
            gap: gap, 
            ad: ads[Math.floor(Math.random() * ads.length)] 
        });
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= 2;

        // Draw Pipes (Billboards)
        ctx.fillStyle = "#1a1a1e";
        ctx.strokeStyle = pipes[i].ad.color;
        ctx.lineWidth = 2;
        
        // Top Pipe
        ctx.fillRect(pipes[i].x, 0, pipes[i].width, pipes[i].y);
        ctx.strokeRect(pipes[i].x, 0, pipes[i].width, pipes[i].y);
        
        // Bottom Pipe
        ctx.fillRect(pipes[i].x, pipes[i].y + pipes[i].gap, pipes[i].width, canvas.height);
        ctx.strokeRect(pipes[i].x, pipes[i].y + pipes[i].gap, pipes[i].width, canvas.height);

        // Ad Text
        ctx.save();
        ctx.translate(pipes[i].x + 30, pipes[i].y / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px sans-serif";
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

    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameOver();
    }

    frameCount++;
    requestAnimationFrame(update);
}

function gameOver() {
    gameRunning = false;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AD-BIRD DOWN", canvas.width / 2, canvas.height / 2);
    ctx.font = "12px sans-serif";
    ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillText("Click to Restart", canvas.width / 2, canvas.height / 2 + 50);
}

canvas.addEventListener('mousedown', () => {
    if (!gameRunning) {
        initGame();
    } else {
        bird.velocity = bird.lift;
    }
});

// Initial screen
ctx.fillStyle = "#fff";
ctx.textAlign = "center";
ctx.font = "14px sans-serif";
ctx.fillText("CLICK TO START FLAPPING", canvas.width / 2, canvas.height / 2);
