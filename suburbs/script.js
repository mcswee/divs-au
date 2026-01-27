document.addEventListener('DOMContentLoaded', () => {
    let phonemeMap = {};
    const searchInput = document.getElementById('suburb-search');

    Promise.all([
        fetch('/english/vowels.csv').then(res => res.text()),
        fetch('/english/consonants.csv').then(res => res.text())
    ]).then(([vowelCsv, consonantCsv]) => {
        
        [vowelCsv, consonantCsv].forEach(csv => {
            const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
            parsed.forEach(row => {
                // Use PHONEME as the key
                const symbol = row.Phoneme ? row.Phoneme.trim() : null;
                if (symbol) {
                    phonemeMap[symbol] = (row.Examples || "").trim();
                }
            });
        });

        const symbols = Object.keys(phonemeMap).sort((a, b) => b.length - a.length);
        if (symbols.length === 0) return loadSuburbTable(null);

        const pattern = new RegExp(symbols.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
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
                    const headers = ["Suburb", "Pronunciation", "LGA", "Postcode"];
                    
                    headers.forEach(key => {
                        const td = document.createElement('td');
                        let content = (row[key] || '').trim();

                        if (key === "Pronunciation" && content && pattern) {
                            td.innerHTML = content.replace(pattern, match => {
                                const tip = phonemeMap[match] || "pronunciation";
                                return `<abbr title="'${match}' as in ${tip}">${match}</abbr>`;
                            });
                        } else {
                            td.textContent = content;
                        }
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });

                finalizeUI();
            }
        });
    }

    function finalizeUI() {
        const table = document.getElementById('suburb-table');
        const rows = table.querySelectorAll('tbody tr');
        const alphabetNav = document.querySelector('.alphabet-nav');
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

        let currentLetter = "";
        rows.forEach(row => {
            const firstChar = row.cells[0].textContent.trim().charAt(0).toUpperCase();
            if (firstChar && /^[A-Z]$/.test(firstChar) && firstChar !== currentLetter) {
                row.id = `letter-${firstChar}`;
                currentLetter = firstChar;
            }
        });

        if (alphabetNav) {
            alphabetNav.innerHTML = letters.map(letter => {
                const exists = document.getElementById(`letter-${letter}`);
                return exists 
                    ? `<a href="#letter-${letter}">${letter}</a>` 
                    : `<span class="disabled">${letter}</span>`;
            }).join(" ");
        }

        if (searchInput) {
            searchInput.addEventListener('input', function () {
                const query = this.value.toLowerCase();
                rows.forEach(row => {
                    const text = row.cells[0].textContent.toLowerCase() + " " + 
                                 (row.cells[2]?.textContent.toLowerCase() || "") + " " + 
                                 (row.cells[3]?.textContent.toLowerCase() || "");
                    row.style.display = text.includes(query) ? '' : 'none';
                });

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
