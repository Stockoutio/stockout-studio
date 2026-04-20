/**
 * Stockout Studio - UI Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
    // Mouse Move Parallax for Background Glow Orbs
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

    // URL Hash Purge: Ensures a clean single-page experience
    if (window.location.hash) {
        history.replaceState(null, null, window.location.pathname);
    }

    console.log("Stockout Studio UI Initialized");
});
