document.addEventListener('DOMContentLoaded', () => {
    let phonemeMap = {};
    const searchInput = document.getElementById('suburb-search');

    // Load reference files for tooltips
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
                let currentLetter = '';
                
                const pattern = new RegExp(
                    Object.keys(phonemeMap)
                        .sort((a, b) => b.length - a.length)
                        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .join('|'), 
                    'g'
                );

                results.data.forEach(row => {
                    const tr = document.createElement('tr');
                    const firstChar = (row.Suburb || "").charAt(0).toUpperCase();

                    // Alphabetical anchors
                    if (firstChar && /^[A-Z]$/.test(firstChar) && firstChar !== currentLetter) {
                        tr.id = `letter-${firstChar}`;
                        currentLetter = firstChar;
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
                
                initSearch();
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
