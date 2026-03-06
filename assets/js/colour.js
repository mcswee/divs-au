/**
 * Core HSL calculations
 */
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

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

function initializeCardData() {
    document.querySelectorAll('.colour-card').forEach(card => {
        const rgb = hexToRgb(card.dataset.hex);
        const hsl = rgbToHsl(rgb);
        card.dataset.hue = hsl.h;
        card.dataset.sat = hsl.s;
        card.dataset.lum = hsl.l;
    });
}

function sortGrid(criterion) {
    const grid = document.getElementById('colour-grid');
    const cards = Array.from(grid.querySelectorAll('.colour-card'));
    const familyOrder = { "reds": 1, "oranges": 2, "yellows": 3, "greens": 4, "blues": 5, "purples": 6, "pinks": 7, "browns": 8, "greys": 9, "neutrals": 10 };

    cards.sort((a, b) => {
        switch(criterion) {
            case 'Name': return a.dataset.name.localeCompare(b.dataset.name);
            case 'Hex': return a.dataset.hex.localeCompare(b.dataset.hex);
            case 'Family': return (familyOrder[a.dataset.family] || 99) - (familyOrder[b.dataset.family] || 99);
            case 'Year':
                const parseY = (v) => v.toLowerCase().includes('imm') ? 0 : (parseInt(v.replace(/\D/g, ''), 10) || 9999);
                return parseY(a.dataset.year) - parseY(b.dataset.year);
            case 'Hue': return parseFloat(a.dataset.hue) - parseFloat(b.dataset.hue);
            case 'Saturation': return parseFloat(a.dataset.sat) - parseFloat(b.dataset.sat);
            case 'Luminosity': return parseFloat(a.dataset.lum) - parseFloat(b.dataset.lum);
            default: return 0;
        }
    });
    cards.forEach(card => grid.appendChild(card));
}

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text);
    const toast = document.getElementById('copy-toast');
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
    const card = element.closest('.colour-card');
    if (card) window.location.hash = card.dataset.name.toLowerCase().replace(/\s+/g, '-');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeCardData();

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            if (document.startViewTransition) document.startViewTransition(() => sortGrid(this.value));
            else sortGrid(this.value);
        });
    }

    const search = document.getElementById('colour-search');
    const filter = document.getElementById('family-filter');
    const filterGrid = () => {
        const term = search.value.toLowerCase().trim().replace('#', '');
        const fam = filter.value.toLowerCase();
        document.querySelectorAll('.colour-card').forEach(c => {
            const match = (c.dataset.name.toLowerCase().includes(term) || c.dataset.hex.toLowerCase().includes(term)) 
                          && (fam === 'all' || c.dataset.family === fam);
            c.style.display = match ? 'block' : 'none';
        });
    };
    if (search) search.addEventListener('input', filterGrid);
    if (filter) filter.addEventListener('change', filterGrid);
});
