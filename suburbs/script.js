function loadTable(file, tableId) {
    return fetch(file)
        .then(res => res.text())
        .then(csv => {
            const data = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
            const tbody = document.querySelector(`#${tableId} tbody`);
            
            data.forEach(row => {
                const tr = document.createElement('tr');
                const headers = Array.from(document.querySelectorAll(`#${tableId} thead th`)).map(th => th.textContent);
                
                headers.forEach(colName => {
                    const td = document.createElement('td');
                    const key = colName === "Example Words" ? "Examples" : colName;
                    td.textContent = row[key] || row[colName] || '';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        });
}

Promise.all([
    loadTable('/suburbs/suburbs.csv', 'suburb-table'),
    loadTable('/suburbs/vowels.csv', 'vowel-table'),
    loadTable('/suburbs/consonants.csv', 'consonant-table')
]).then(() => {
    new Tablesort(document.getElementById('suburb-table'));
    
    const searchInput = document.getElementById('suburb-search');
    const tbody = document.querySelector('#suburb-table tbody');
    const rows = tbody.querySelectorAll('tr');

    // INTEGRATED SEARCH LOGIC
    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        let visibleCount = 0;

        rows.forEach(row => {
            const suburb = row.cells[0].textContent.toLowerCase();
            if (suburb.includes(query)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        // Toggle the red border class based on results
        if (query.length > 0 && visibleCount === 0) {
            this.classList.add('no-results');
        } else {
            this.classList.remove('no-results');
        }
    });
});
