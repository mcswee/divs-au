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
 * Results (h, s, l) are decimals between 0 and 1.
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

// Keep your hexToRgb and rgbToHsl functions exactly as they are.

let allData = []; // Store the processed data globally

function buildGrid(data) {
    const grid = document.querySelector("#colour-grid");
    if (!grid) return;

    grid.innerHTML = data.map(item => {
        // 1. Logic for text contrast on the "Copy Hex" overlay
        const isLight = item.lum > 0.6;
        const textColor = isLight ? '#000' : '#fff';

        // 2. Logic for the Year display string
        const rawYear = item.Year.toString().toLowerCase();
        let displayYear;

        if (rawYear.includes('imm')) {
            displayYear = "time immemorial";
        } else {
            displayYear = `from ${item.Year}`;
        }

        // 3. The actual HTML template
        return `
        <div class="colour-card" 
             data-name="${item.Name}" 
             data-hex="${item.Hex}" 
             data-family="${item.Family.toLowerCase()}"
             style="view-transition-name: card-${item.Name.replace(/\s+/g, '-')};">
            <div class="swatch" style="background-color:${item.Hex};" onclick="copyToClipboard('${item.Hex}', this)">
                <span class="copy-label" style="color: ${textColor}">Copy ${item.Hex}</span>
            </div>
            <div class="card-info">
                <div class="card-row">
                    <span class="card-name">${item.Name}</span>
                </div>
                <code class="card-hex">${item.Hex}</code>
                <span class="card-year">${displayYear}</span>
            </div>
        </div>
        `;
    }).join('');
}

// Clipboard Function
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text);
    const toast = document.getElementById('copy-toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
    
    // Update URL hash
    const card = element.closest('.colour-card');
    window.location.hash = card.dataset.name.toLowerCase().replace(/\s+/g, '-');
}

Papa.parse("colours.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        allData = results.data.map(item => {
            const rgb = hexToRgb(item.Hex);
            const hsl = rgbToHsl(rgb);
            return { ...item, hue: hsl.h, lum: hsl.l, sat: hsl.s };
        });

        // Initial build
        buildGrid(allData);

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

        // Sorting Logic
        const sortSelect = document.getElementById('sort-select');
        sortSelect.addEventListener('change', function() {
            const val = this.value;
            if (document.startViewTransition) {
                document.startViewTransition(() => sortAndRebuild(val));
            } else {
                sortAndRebuild(val);
            }
        });

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

        searchInput.addEventListener('input', filterGrid);
        familyFilter.addEventListener('change', filterGrid);
    }
});

function sortAndRebuild(criterion) {
    const familyOrder = { "reds": 1, "oranges": 2, "yellows": 3, "greens": 4, "blues": 5, "purples": 6, "pinks": 7, "browns": 8, "greys": 9, "neutrals": 10 };

    allData.sort((a, b) => {
        switch(criterion) {
            case 'Name': return a.Name.localeCompare(b.Name);
            case 'Hex': return a.Hex.localeCompare(b.Hex);
            case 'Year':
                const parseYear = (val) => {
                    if (!val) return 9999;
                    const s = val.toString().toLowerCase();
                    if (s.includes('imm')) return 0;
                    const num = parseInt(s.replace(/\D/g, ''), 10);
                    return isNaN(num) ? 9999 : num;
                };
                const yearDiff = parseYear(a.Year) - parseYear(b.Year);
                return yearDiff !== 0 ? yearDiff : a.Name.localeCompare(b.Name);
            case 'Family': return (familyOrder[a.Family.toLowerCase()] || 99) - (familyOrder[b.Family.toLowerCase()] || 99);
            case 'Hue': return a.hue - b.hue;
            case 'Luminosity': return a.lum - b.lum;
            case 'Saturation': return a.sat - b.sat;
            default: return 0;
        }
    });
    buildGrid(allData);
}
