function loadTable(file, tableId) {
    return fetch(file)
        .then(res => res.text())
        .then(csv => {
            const data = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
            const tbody = document.querySelector(`#${tableId} tbody`);
            if (!tbody) return;
            
            data.forEach(row => {
                const tr = document.createElement('tr');
                const headers = Array.from(document.querySelectorAll(`#${tableId} thead th`)).map(th => th.textContent);
                
                headers.forEach(colName => {
                    const td = document.createElement('td');
                    // Matches your specific CSV header weirdness
                    const key = colName === "Example Words" ? "Examples" : colName;
                    td.textContent = row[key] || row[colName] || '';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        });
}

// 1. Wait for ALL tables to load before doing anything with the rows
Promise.all([
    loadTable('/suburbs/suburbs.csv', 'suburb-table'),
    loadTable('/suburbs/vowels.csv', 'vowel-table'),
    loadTable('/suburbs/consonants.csv', 'consonant-table')
]).then(() => {
    const table = document.getElementById('suburb-table');
    if (!table) return;

    new Tablesort(table);
    
    const searchInput = document.getElementById('suburb-search');
    const tbody = table.querySelector('tbody');
    const rows = tbody.getElementsByTagName('tr'); // Live collection for speed
    const alphabetNav = document.querySelector('.alphabet-nav');
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    // 2. BUILD THE JUMP LIST
    if (alphabetNav) {
        let currentLetter = "";
        
        // Add IDs to the first row of each alphabetical group for the anchors to hit
        Array.from(rows).forEach(row => {
            const firstChar = row.cells[0].textContent.trim().charAt(0).toUpperCase();
            if (firstChar && /^[A-Z]$/.test(firstChar) && firstChar !== currentLetter) {
                row.id = `letter-${firstChar}`;
                currentLetter = firstChar;
            }
        });

        // Generate the A-Z links
        alphabetNav.innerHTML = letters.map(letter => {
            const exists = document.getElementById(`letter-${letter}`);
            return exists 
                ? `<a href="#letter-${letter}">${letter}</a>` 
                : `<span class="disabled">${letter}</span>`;
        }).join(" ");
    }

    // 3. INTEGRATED SEARCH (Suburbs, LGA, Postcode) + SMART JUMP LINKS
    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        let visibleCount = 0;

        // Filter Rows
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const suburb = row.cells[0].textContent.toLowerCase();
            const lga = row.cells[2] ? row.cells[2].textContent.toLowerCase() : "";
            const postcode = row.cells[3] ? row.cells[3].textContent.toLowerCase() : "";
            
            if (suburb.includes(query) || lga.includes(query) || postcode.includes(query)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        }

        // Smart Fix: Toggle Jump Link visibility based on search results
        if (alphabetNav) {
            letters.forEach(letter => {
                const link = alphabetNav.querySelector(`a[href="#letter-${letter}"]`);
                if (!link) return;

                const hasVisibleRows = Array.from(rows).some(r => 
                    r.style.display !== 'none' && 
                    r.cells[0].textContent.trim().toUpperCase().startsWith(letter)
                );
                link.style.visibility = hasVisibleRows ? 'visible' : 'hidden';
            });
        }

        // Error state for search input
        this.classList.toggle('no-results', query.length > 0 && visibleCount === 0);
    });
});
