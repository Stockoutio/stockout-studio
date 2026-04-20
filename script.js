// Music Control Logic
const music = document.getElementById('bgMusic');
const musicToggle = document.getElementById('musicToggle');
let isPlaying = false;

if (musicToggle) {
    musicToggle.addEventListener('click', () => {
        if (!isPlaying) {
            music.play();
            musicToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            isPlaying = true;
        } else {
            music.pause();
            musicToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            isPlaying = false;
        }
    });
}

// Mouse Move Parallax for Glow Orbs
document.addEventListener('mousemove', (e) => {
    const orbs = document.querySelectorAll('.glow-orb');
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    orbs.forEach((orb, index) => {
        const speed = (index + 1) * 20;
        const x = (window.innerWidth - mouseX * speed) / 100;
        const y = (window.innerHeight - mouseY * speed) / 100;

        orb.style.transform = `translateX(${x}px) translateY(${y}px)`;
    });
});
