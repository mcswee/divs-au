document.addEventListener('DOMContentLoaded', () => {
    let phonemeMap = {}; // Dictionary for tooltips

    function loadTable(file, tableId) {
        return fetch(file)
            .then(res => res.text())
            .then(csv => {
                const data = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
                const tbody = document.querySelector(`#${tableId} tbody`);
                if (!tbody) return;

                // If this is a reference table, store the symbols for tooltips
                if (tableId === 'vowel-table' || tableId === 'consonant-table') {
                    data.forEach(row => {
                        if (row.Symbol) phonemeMap[row.Symbol] = row.Examples || "";
                    });
                }

                // Prepare regex for the Suburb table tooltips
                const symbols = Object.keys(phonemeMap).sort((a, b) => b.length - a.length);
                const pattern = new RegExp(symbols.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

                data.forEach(row => {
                    const tr = document.createElement('tr');
                    const headers = Array.from(document.querySelectorAll(`#${tableId} thead th`)).map(th => th.textContent);

                    headers.forEach(colName => {
                        const td = document.createElement('td');
                        const key = colName === "Example Words" ? "Examples" : colName;
                        let content = row[key] || row[colName] || '';

                        // Inject tooltips ONLY in the Pronunciation column of the suburb table
                        if (tableId === 'suburb-table' && colName === "Pronunciation" && content) {
                            td.innerHTML = content.replace(pattern, match => {
                                return `<abbr title="as in ${phonemeMap[match]}">${match}</abbr>`;
                            });
                        } else {
                            td.textContent = content;
                        }
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
            });
    }

    // 1. Wait for ALL tables to load
    Promise.all([
        loadTable('/suburbs/vowels.csv', 'vowel-table'),
        loadTable('/suburbs/consonants.csv', 'consonant-table')
    ]).then(() => {
        // Load suburb table last so phonemeMap is ready
        return loadTable('/suburbs/suburbs.csv', 'suburb-table');
    }).then(() => {
        const table = document.getElementById('suburb-table');
        if (!table) return;

        new Tablesort(table);

        const searchInput = document.getElementById('suburb-search');
        const tbody = table.querySelector('tbody');
        const rows = tbody.getElementsByTagName('tr');
        const alphabetNav = document.querySelector('.alphabet-nav');
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

        // 2. BUILD THE JUMP LIST
        if (alphabetNav) {
            let currentLetter = "";
            Array.from(rows).forEach(row => {
                const firstChar = row.cells[0].textContent.trim().charAt(0).toUpperCase();
                if (firstChar && /^[A-Z]$/.test(firstChar) && firstChar !== currentLetter) {
                    row.id = `letter-${firstChar}`;
                    currentLetter = firstChar;
                }
            });

            alphabetNav.innerHTML = letters.map(letter => {
                const exists = document.getElementById(`letter-${letter}`);
                return exists 
                    ? `<a href="#letter-${letter}">${letter}</a>` 
                    : `<span class="disabled">${letter}</span>`;
            }).join(" ");
        }

        // 3. INTEGRATED SEARCH
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                const query = this.value.toLowerCase();
                let visibleCount = 0;

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
                this.classList.toggle('no-results', query.length > 0 && visibleCount === 0);
            });
        }
    });
});
