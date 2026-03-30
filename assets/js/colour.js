// 1. Initialise constants and card array
const searchInput = document.getElementById('colour-search');
const sortSelect = document.getElementById('sort-select');
const dirBtn = document.getElementById('sort-direction');
const familyFilter = document.getElementById('family-filter');
const colourGrid = document.getElementById('colour-grid');

// Convert NodeList to a persistent Array for sorting
const cards = Array.from(document.querySelectorAll('.colour-card'));

// 2. The Filter Logic (Search + Family)
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedFamily = familyFilter.value; // R, O, Y, G, T, B, V, P, N, K, W or "all"

    cards.forEach(card => {
        const name = card.dataset.name;
        const hex = card.dataset.hex;
        const family = card.dataset.family;

        const matchesSearch = name.includes(searchTerm) || hex.includes(searchTerm);
        const matchesFamily = (selectedFamily === 'all' || family === selectedFamily);

        card.style.display = (matchesSearch && matchesFamily) ? '' : 'none';
    });
}

// 3. The Sort Logic (Numeric + Directional)
function applySort() {
    const sortBy = sortSelect.value; // Matches data- attributes
    const direction = dirBtn.getAttribute('data-dir'); // "asc" or "desc"
    
    const sortedCards = cards.sort((a, b) => {
        let valA = a.dataset[sortBy];
        let valB = b.dataset[sortBy];

        // Numeric fields: Year, Hue, Sat, Lum, WCAG, YQI
        if (!['name', 'family', 'hex'].includes(sortBy)) {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            
            return direction === 'asc' ? valA - valB : valB - valA;
        }

        // Alphabetical fields: Name, Hex
        let comparison = valA.localeCompare(valB);
        return direction === 'asc' ? comparison : comparison * -1;
    });

    // Efficiently re-inject sorted cards
    const fragment = document.createDocumentFragment();
    sortedCards.forEach(card => fragment.appendChild(card));
    colourGrid.appendChild(fragment);
}

// 4. Sort Direction Toggle
dirBtn.addEventListener('click', () => {
    const currentDir = dirBtn.getAttribute('data-dir');
    const newDir = currentDir === 'asc' ? 'desc' : 'asc';
    
    dirBtn.setAttribute('data-dir', newDir);
    dirBtn.innerText = newDir === 'asc' ? '↑ Asc' : '↓ Desc';
    applySort();
});

// 5. Event Listeners for Filters
searchInput.addEventListener('input', applyFilters);
familyFilter.addEventListener('change', applyFilters);
sortSelect.addEventListener('change', applySort);

// 6. Copy to Clipboard Utility
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.getElementById('copy-toast');
        const label = element.querySelector('.swatch-label');
        const originalText = label.innerText;

        toast.classList.add('show');
        label.innerText = 'Copied!';
        
        setTimeout(() => {
            toast.classList.remove('show');
            label.innerText = originalText;
        }, 2000);
    }).catch(err => console.error('Error copying hex:', err));
}
