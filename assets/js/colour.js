// 1. Initialise constants and card array
const searchInput = document.getElementById('colour-search');
const sortSelect = document.getElementById('sort-select');
const dirBtn = document.getElementById('sort-direction');
const familyFilter = document.getElementById('family-filter');
const colourGrid = document.getElementById('colour-grid');

// Convert NodeList to a persistent Array for sorting
const cards = Array.from(document.querySelectorAll('.colour-card'));

// 2. Accessibility Helper: Screen Reader Announcements
const announce = (message) => {
    let status = document.getElementById('sr-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'sr-status';
        status.setAttribute('aria-live', 'polite');
        status.classList.add('sr-only'); 
        document.body.appendChild(status);
    }
    status.textContent = message;
};

// 3. Utility: Debounce to prevent UI/Screen Reader "stutter"
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// 4. The Filter Logic (Search + Family)
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedFamily = familyFilter.value;
    let visibleCount = 0;

    cards.forEach(card => {
        const name = card.dataset.name;
        const hex = card.dataset.hex;
        const family = card.dataset.family;

        const matchesSearch = name.includes(searchTerm) || hex.includes(searchTerm);
        const matchesFamily = (selectedFamily === 'all' || family === selectedFamily);
        const isVisible = matchesSearch && matchesFamily;

        card.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });

    announce(`${visibleCount} colours matching your criteria.`);
}

// 5. The Sort Logic
function applySort() {
    const sortBy = sortSelect.value;
    const direction = dirBtn.getAttribute('data-dir'); 
    
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
        const numericFields = ['year', 'hue', 'sat', 'lum', 'wcagW', 'wcagK', 'yqi'];

        if (numericFields.includes(dataKey)) {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }

        let comparison = (valA || "").localeCompare(valB || "");
        return direction === 'asc' ? comparison : comparison * -1;
    });

    const fragment = document.createDocumentFragment();
    sortedCards.forEach(card => fragment.appendChild(card));
    colourGrid.appendChild(fragment);
}

// 6. Event Listeners
dirBtn.addEventListener('click', () => {
    const currentDir = dirBtn.getAttribute('data-dir');
    const newDir = currentDir === 'asc' ? 'desc' : 'asc';
    
    dirBtn.setAttribute('data-dir', newDir);
    dirBtn.setAttribute('aria-pressed', newDir === 'desc');
    dirBtn.innerText = newDir === 'asc' ? '↑ Ascending' : '↓ Descending';
    
    announce(`Sorted by ${sortSelect.options[sortSelect.selectedIndex].text} ${newDir === 'asc' ? 'ascending' : 'descending'}.`);
    applySort();
});

// Use debounced filter for the search input
const debouncedFilter = debounce(applyFilters, 300);
searchInput.addEventListener('input', debouncedFilter);

familyFilter.addEventListener('change', applyFilters);
sortSelect.addEventListener('change', () => {
    applySort();
    announce(`List re-sorted by ${sortSelect.options[sortSelect.selectedIndex].text}.`);
});

// 7. Copy to Clipboard Utility
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const label = element.querySelector('.swatch-label');
        const originalText = label.innerText;

        announce(`Hex code ${text} copied.`);
        label.innerText = 'Copied!';
        
        setTimeout(() => {
            label.innerText = originalText;
        }, 2000);
    }).catch(err => console.error('Error copying hex:', err));
}
