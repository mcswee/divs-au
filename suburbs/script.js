document.addEventListener('DOMContentLoaded', () => {
    let phonemeMap = {};
    let currentLetter = '';

    // 1. Load reference files first
    Promise.all([
        fetch('/suburbs/vowels.csv').then(res => res.text()),
        fetch('/suburbs/consonants.csv').then(res => res.text())
    ]).then(([vowelCsv, consonantCsv]) => {
        
        // Build map from CSV data
        [vowelCsv, consonantCsv].forEach(csv => {
            const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
            parsed.forEach(row => {
                if (row.Symbol) {
                    // Uses your 'Examples' header for the tooltip text
                    phonemeMap[row.Symbol] = row.Examples || "";
                }
            });
        });

        // 2. Load and build the table once map is ready
        loadSuburbTable();
    });

    function loadSuburbTable() {
        Papa.parse('/suburbs/suburbs.csv', {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const tableBody = document.querySelector('#suburb-table tbody');
                // Regex pattern: sorts by length to prioritize diphthongs/long symbols
                const pattern = new RegExp(
                    Object.keys(phonemeMap)
                        .sort((a, b) => b.length - a.length)
                        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escape regex chars
                        .join('|'), 
                    'g'
                );

                results.data.forEach(row => {
                    const tr = document.createElement('tr');
                    const suburbName = row.Suburb || "";
                    const firstChar = suburbName.charAt(0).toUpperCase();

                    // Set alphabetical anchors for jump links
                    if (firstChar && /^[A-Z]$/.test(firstChar) && firstChar !== currentLetter) {
                        tr.id = `letter-${firstChar}`;
                        currentLetter = firstChar;
                    }

                    // Build cells
                    Object.keys(row).forEach(key => {
                        const td = document.createElement('td');
                        let content = row[key] || "";

                        if (key === "Pronunciation") {
                            // Injects the <abbr> tags
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

                // Post-render initializations
                if (typeof Tablesort !== 'undefined') {
                    new Tablesort(document.getElementById('suburb-table'));
                }
                updateNavState();
            }
        });
    }

    function updateNavState() {
        const navLinks = document.querySelectorAll('.alphabet-nav a');
        navLinks.forEach(link => {
            const letter = link.getAttribute('data-letter');
            if (!document.getElementById(`letter-${letter}`)) {
                link.style.opacity = '0.3';
                link.style.pointerEvents = 'none';
            }
        });
    }
});
