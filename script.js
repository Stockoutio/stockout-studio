/**
 * Stockout Studio - UI Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
    // Mouse Move Parallax for Background Glow Orbs
    document.addEventListener('mousemove', (e) => {
        const orbs = document.querySelectorAll('.glow-orb');
        const mouseX = (e.clientX / window.innerWidth) - 0.5;
        const mouseY = (e.clientY / window.innerHeight) - 0.5;

        orbs.forEach((orb, index) => {
            const intensity = (index + 1) * 30;
            const x = mouseX * intensity;
            const y = mouseY * intensity;

            orb.style.transform = `translate(${x}px, ${y}px)`;
        });
    });

    console.log("Stockout Studio UI Initialized");
});
