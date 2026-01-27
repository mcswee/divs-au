document.addEventListener('DOMContentLoaded', () => {
    let phonemeMap = {};
    const searchInput = document.getElementById('suburb-search');

    // 1. Load the reference data first
    Promise.all([
        fetch('/english/vowels.csv').then(res => res.text()),
        fetch('/english/consonants.csv').then(res => res.text())
    ]).then(([vowelCsv, consonantCsv]) => {
        
        // Parse reference files into the map
        [vowelCsv, consonantCsv].forEach(csv => {
            const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
            parsed.forEach(row => {
                if (row.Symbol) {
                    phonemeMap[row.Symbol] = (row.Examples || row["Example Words"] || "").trim();
                }
            });
        });

        // Create the regex pattern once the map is full
        const symbols = Object.keys(phonemeMap).sort((a, b) => b.length - a.length);
        const pattern = new RegExp(symbols.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

        // 2. NOW load the suburb table using that pattern
        loadSuburbTable(pattern);
    });

    function loadSuburbTable(pattern) {
        Papa.parse('suburbs.csv', {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const tbody = document.querySelector('#suburb-table tbody');
                if (!tbody) return;

                results.data.forEach(row => {
                    const tr = document.createElement('tr');
                    
                    // Maintain your specific column order/logic
                    const headers = ["Suburb", "Pronunciation", "LGA", "Postcode"];
                    
                    headers.forEach(key => {
                        const td = document.createElement('td');
                        let content = row[key] || '';

                        if (key === "Pronunciation" && content) {
                            // The actual injection
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

                // 3. Kick off the UI features
                finalizeUI();
            }
        });
    }

    function finalizeUI() {
        const table = document.getElementById('suburb-table');
        const rows = table.querySelectorAll('tbody tr');
        const alphabetNav = document.querySelector('.alphabet-nav');
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

        // Build Jump List IDs
        let currentLetter = "";
        rows.forEach(row => {
            const firstChar = row.cells[0].textContent.trim().charAt(0).toUpperCase();
            if (firstChar && /^[A-Z]$/.test(firstChar) && firstChar !== currentLetter) {
                row.id = `letter-${firstChar}`;
                currentLetter = firstChar;
            }
        });

        // Generate Nav Links
        if (alphabetNav) {
            alphabetNav.innerHTML = letters.map(letter => {
                const exists = document.getElementById(`letter-${letter}`);
                return exists 
                    ? `<a href="#letter-${letter}">${letter}</a>` 
                    : `<span class="disabled">${letter}</span>`;
            }).join(" ");
        }

        // Initialize Search
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                const query = this.value.toLowerCase();
                rows.forEach(row => {
                    const text = row.cells[0].textContent.toLowerCase() + " " + 
                                 (row.cells[2]?.textContent.toLowerCase() || "") + " " + 
                                 (row.cells[3]?.textContent.toLowerCase() || "");
                    row.style.display = text.includes(query) ? '' : 'none';
                });

                // Smart Nav visibility
                if (alphabetNav) {
                    letters.forEach(letter => {
                        const link = alphabetNav.querySelector(`a[href="#letter-${letter}"]`);
                        if (!link) return;
                        const hasVisible = Array.from(rows).some(r => 
                            r.style.display !== 'none' && 
                            r.cells[0].textContent.trim().toUpperCase().startsWith(letter)
                        );
                        link.style.visibility = hasVisible ? 'visible' : 'hidden';
                    });
                }
            });
        }

        if (typeof Tablesort !== 'undefined') new Tablesort(table);
    }
});
