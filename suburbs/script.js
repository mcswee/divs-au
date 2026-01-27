document.addEventListener('DOMContentLoaded', () => {
    let phonemeMap = {};
    const searchInput = document.getElementById('suburb-search');

    Promise.all([
        fetch('/suburbs/vowels.csv').then(res => res.text()),
        fetch('/suburbs/consonants.csv').then(res => res.text())
    ]).then(([vowelCsv, consonantCsv]) => {
        [vowelCsv, consonantCsv].forEach(csv => {
            const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
            parsed.forEach(row => {
                if (row.Symbol) {
                    phonemeMap[row.Symbol] = row.Examples || "";
                }
            });
        });
        loadSuburbTable();
    });

    function loadSuburbTable() {
        Papa.parse('/suburbs/suburbs.csv', {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const tableBody = document.querySelector('#suburb-table tbody');
                let foundLetters = new Set();
                
                const pattern = new RegExp(
                    Object.keys(phonemeMap)
                        .sort((a, b) => b.length - a.length)
                        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .join('|'), 
                    'g'
                );

                results.data.forEach(row => {
                    const tr = document.createElement('tr');
                    const suburbName = row.Suburb ? row.Suburb.trim() : "";
                    const firstChar = suburbName.charAt(0).toUpperCase();

                    // This generates the actual anchor IDs in the table
                    if (firstChar && /^[A-Z]$/.test(firstChar) && !foundLetters.has(firstChar)) {
                        tr.id = `letter-${firstChar}`;
                        foundLetters.add(firstChar);
                    }

                    Object.keys(row).forEach(key => {
                        const td = document.createElement('td');
                        let content = row[key] || "";
                        if (key === "Pronunciation") {
                            td.innerHTML = content.replace(pattern, match => {
                                return `<abbr title="as in ${phonemeMap[match]}">${match}</abbr>`;
                            });
                        } else {
                            td.textContent = content;
                        }
                        tr.appendChild(td);
                    });
                    tableBody.appendChild(tr);
                });

                if (typeof Tablesort !== 'undefined') {
                    new Tablesort(document.getElementById('suburb-table'));
                }
                
                // RESTORED: This activates your nav links
                updateNavState();
                initSearch();
            }
        });
    }

    function updateNavState() {
        const navLinks = document.querySelectorAll('.alphabet-nav a');
        navLinks.forEach(link => {
            const letter = link.getAttribute('data-letter');
            const targetExists = document.getElementById(`letter-${letter}`);
            
            if (!targetExists) {
                link.style.opacity = '0.3';
                link.style.pointerEvents = 'none';
            } else {
                link.style.opacity = '1';
                link.style.pointerEvents = 'auto';
            }
        });
    }

    function initSearch() {
        if (!searchInput) return;
        searchInput.addEventListener('input', function() {
            const filter = this.value.toLowerCase();
            const rows = document.querySelectorAll('#suburb-table tbody tr');
            rows.forEach(row => {
                const text = row.cells[0].textContent.toLowerCase() + " " + (row.cells[2] ? row.cells[2].textContent.toLowerCase() : "");
                row.style.display = text.includes(filter) ? '' : 'none';
            });
        });
    }
});
