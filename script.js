// Music Control Logic
window.music = document.getElementById('bgMusic');
window.isPlaying = false; // Muted by default

const musicToggle = document.getElementById('musicToggle');

if (musicToggle) {
    musicToggle.addEventListener('click', () => {
        if (!window.isPlaying) {
            window.isPlaying = true;
            musicToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        } else {
            window.isPlaying = false;
            window.music.pause();
            musicToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
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
