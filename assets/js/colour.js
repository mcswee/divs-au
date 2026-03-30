/**
 * UI Logic for 186-colour Grid
 * Handles sorting, filtering, and accessibility contrast
 */

function cleanValue(val) {
    if (!val) return 0;
    // Remove degree symbols, percentages, and non-numeric characters for sorting
    const cleaned = val.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
}

function parseYear(v) {
    if (!v) return 9999;
    const lower = v.toLowerCase();
    if (lower.includes('imm')) return 0;
    const match = lower.match(/\d+/);
    return match ? parseInt(match[0], 10) : 9999;
}

function initializeCardData() {
    document.querySelectorAll('.colour-card').forEach(card => {
        // Use your WCAG columns to determine the most readable text colour
        const vsWhite = cleanValue(card.dataset.wcagVsFff);
        const vsBlack = cleanValue(card.dataset.wcagVs000);

        // Best-fit text colour: if contrast vs White is higher, use white text.
        card.style.color = vsWhite > vsBlack ? '#ffffff' : '#000000';
        card.style.backgroundColor = card.dataset.hex;
    });
}

function sortGrid(criterion, ascending = true) {
    const grid = document.getElementById('colour-grid');
    const cards = Array.from(grid.querySelectorAll('.colour-card'));
    
    // Mapping single-letter CSV codes to a logical spectrum order
    const familyOrder = { 
        "R": 1, "O": 2, "Y": 3, "G": 4, "T": 5, "B": 6, 
        "V": 7, "P": 8, "N": 9, "K": 10, "W": 11 
    };

    cards.sort((a, b) => {
        let valA, valB;
        // Map "WCAG vs fff" to "wcag-vs-fff" for the dataset key
        const key = criterion.toLowerCase().replace(/[\s_]+/g, '-');

        switch(criterion) {
            case 'Family':
                valA = familyOrder[a.dataset.fam] || 99;
                valB = familyOrder[b.dataset.fam] || 99;
                break;

            case 'Year':
                valA = parseYear(a.dataset.year);
                valB = parseYear(b.dataset.year);
                break;

            case 'Name':
            case 'Hex':
                valA = a.dataset[key]?.toLowerCase() || '';
                valB = b.dataset[key]?.toLowerCase() || '';
                return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);

            default: 
                // Handles Hue, Sat, Lum, R, G, B, YIQ, and WCAG columns
                valA = cleanValue(a.dataset[key]);
                valB = cleanValue(b.dataset[key]);
                break;
        }
        
        return ascending ? valA - valB : valB - valA;
    });

    cards.forEach(card => grid.appendChild(card));
}

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text);
    const toast = document.getElementById('copy-toast');
    if (toast) { 
        toast.classList.add('show'); 
        setTimeout(() => toast.classList.remove('show'), 2000); 
    }
    const card = element.closest('.colour-card');
    if (card) {
        window.location.hash = card.dataset.name.toLowerCase().replace(/\s+/g, '-');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeCardData();

    let lastSort = '';
    let isAscending = true;

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            if (this.value === lastSort) {
                isAscending = !isAscending;
            } else {
                isAscending = true;
                lastSort = this.value;
            }
            
            if (document.startViewTransition) {
                document.startViewTransition(() => sortGrid(this.value, isAscending));
            } else {
                sortGrid(this.value, isAscending);
            }
        });
    }

    const search = document.getElementById('colour-search');
    const filter = document.getElementById('family-filter');

    const filterGrid = () => {
        const term = search.value.toLowerCase().trim().replace('#', '');
        const fam = filter.value.toUpperCase(); 
        
        document.querySelectorAll('.colour-card').forEach(c => {
            const match = (c.dataset.name.toLowerCase().includes(term) || c.dataset.hex.toLowerCase().includes(term)) 
                          && (fam === 'ALL' || c.dataset.fam === fam);
            c.style.display = match ? 'block' : 'none';
        });
    };

    if (search) search.addEventListener('input', filterGrid);
    if (filter) filter.addEventListener('change', filterGrid);
});
