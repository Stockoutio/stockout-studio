// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    window.music = document.getElementById('bgMusic');
    window.isPlaying = true; // Enabled by default, will play on first interaction

    const musicToggle = document.getElementById('musicToggle');
    if (musicToggle) {
        // Start with the volume icon "On"
        musicToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        
        musicToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent game from starting when clicking mute
            if (!window.isPlaying) {
                window.isPlaying = true;
                musicToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            } else {
                window.isPlaying = false;
                if (window.music) window.music.pause();
                musicToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            }
        });
    }
});

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
