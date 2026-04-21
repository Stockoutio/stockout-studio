/**
 * Stockout Studio - UI Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
    const orbs = document.querySelectorAll('.glow-orb');
    
    // Mouse Move Parallax for Background Glow Orbs
    document.addEventListener('mousemove', (e) => {
        const mouseX = (e.clientX / window.innerWidth) - 0.5;
        const mouseY = (e.clientY / window.innerHeight) - 0.5;

        orbs.forEach((orb, index) => {
            const intensity = (index + 1) * 30;
            const x = mouseX * intensity;
            const y = mouseY * intensity;

            orb.style.transform = `translate(${x}px, ${y}px)`;
        });
    });

    // Mobile Menu Toggle
    const t = document.getElementById('mobileMenuToggle'); 
    const n = document.getElementById('navLinks');
    if (t && n) { 
        t.onclick = (e) => {
            e.stopPropagation(); 
            n.classList.toggle('active');
            t.classList.toggle('active');
        }; 
        document.addEventListener('click', () => {
            n.classList.remove('active');
            t.classList.remove('active');
        }); 
        n.onclick = (e) => e.stopPropagation(); 
    }

    console.log("Stockout Studio UI Initialized");
});
