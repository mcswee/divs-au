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
    const sortBy = sortSelect.value; // e.g., "wcag-w", "yqi", "name"
    const direction = dirBtn.getAttribute('data-dir'); 
    
    // Map the hyphenated HTML values to the camelCase dataset keys
    const keyMap = {
        'wcag-w': 'wcagW',
        'wcag-k': 'wcagK',
        'yqi': 'yqi',
        'name': 'name',
        'year': 'year',
        'hue': 'hue',
        'lum': 'lum',
        'sat': 'sat'
    };

    const dataKey = keyMap[sortBy] || sortBy;

    const sortedCards = cards.sort((a, b) => {
        let valA = a.dataset[dataKey];
        let valB = b.dataset[dataKey];

        // List all numeric fields here. 
        // Note: Dataset keys are camelCase now.
        const numericFields = ['year', 'hue', 'sat', 'lum', 'wcagW', 'wcagK', 'yqi'];

        if (numericFields.includes(dataKey)) {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }

        // Fallback for strings (Name, Hex)
        let comparison = (valA || "").localeCompare(valB || "");
        return direction === 'asc' ? comparison : comparison * -1;
    });

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
