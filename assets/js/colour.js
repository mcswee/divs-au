/**
 * Convert Hex strings (#FFFFFF) to RGB objects for HSL calculation.
 */
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

/**
 * Convert RGB to HSL. 
 */
function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

// Clipboard Function
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text);
    const toast = document.getElementById('copy-toast');
    if (toast) {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
    
    // Update URL hash
    const card = element.closest('.colour-card');
    if (card) {
        window.location.hash = card.dataset.name.toLowerCase().replace(/\s+/g, '-');
    }
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
    // Deep link handling (scrolling to #name in URL)
    const hash = decodeURIComponent(window.location.hash.replace('#', '')).toLowerCase();
    if (hash) {
        const targetCard = Array.from(document.querySelectorAll('.colour-card'))
            .find(c => c.dataset.name.toLowerCase() === hash);

        if (targetCard) {
            setTimeout(() => {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.style.outline = '3px solid var(--brand-main)';
                targetCard.style.outlineOffset = '4px';
                setTimeout(() => { targetCard.style.outline = 'none'; }, 2000);
            }, 300);
        }
    }

    // Filter Logic
    const searchInput = document.getElementById('colour-search');
    const familyFilter = document.getElementById('family-filter');

    function filterGrid() {
        const searchTerm = searchInput.value.toLowerCase().trim().replace('#', '');
        const selectedFamily = familyFilter.value.toLowerCase();
        const cards = document.querySelectorAll('.colour-card');

        cards.forEach(card => {
            const name = card.dataset.name.toLowerCase();
            const hex = card.dataset.hex.toLowerCase().replace('#', '');
            const family = card.dataset.family;

            const matchesSearch = name.includes(searchTerm) || hex.includes(searchTerm);
            const matchesFamily = (selectedFamily === 'all' || family === selectedFamily);

            card.style.display = (matchesSearch && matchesFamily) ? 'block' : 'none';
        });
    }

    if (searchInput) searchInput.addEventListener('input', filterGrid);
    if (familyFilter) familyFilter.addEventListener('change', filterGrid);
});
