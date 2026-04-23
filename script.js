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

    // Game Init (Supabase fetch + AdBird instance)
    const initGame = async () => {
        let paidAds = [];
        const SUPABASE_URL = 'https://agbtvbymknayxrebochn.supabase.co'; 
        const SUPABASE_KEY = 'sb_publishable_8yipwhYLiM19LVR8qLXT6A_MOD1YTl1';
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/ads?select=text&is_paid=eq.true&status=eq.approved&expires_at=gt.now()`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (response.ok) {
                const data = await response.json();
                const colors = ['#a855f7', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899', '#f43f5e'];
                paidAds = data.map(ad => {
                    const color = ad.color || colors[Math.floor(Math.random() * colors.length)];
                    return { ...ad, isPaid: true, color };
                });
            }
        } catch (e) {
            console.warn("Backend unavailable or not configured, using stock ads only.");
        }
        window.adBirdGame = new AdBird('adBirdCanvas', { paidAds });
    };
    initGame();
    
    console.log("Stockout Studio UI Initialized");
});
