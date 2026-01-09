/**
 * Convert Hex strings (#FFFFFF) to RGB objects for HSL calculation.
 */
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

/**
 * Convert RGB to HSL. 
 * Results (h, s, l) are decimals between 0 and 1.
 */
function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

/**
 * Inject rows into the table.
 * Columns 4-7 are hidden but contain the raw data used for sorting.
 */
function buildTable(data) {
    const tbody = document.querySelector("#colour-table tbody");
    if (!tbody) return;
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${item.Name}</td>
            <td style="background-color:${item.Hex}; width:2.5em;"></td>
            <td>${item.Hex}</td>
            <td>${item.Year}</td>
            <td>${item.Family}</td>
            <td>${item.hue}</td>
            <td>${item.lum}</td>
            <td>${item.sat}</td>
        </tr>
    `).join('');
}

Papa.parse("colours.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        // Step 1: Process CSV data and calculate HSL values
        const data = results.data.map(item => {
            const rgb = hexToRgb(item.Hex);
            const hsl = rgbToHsl(rgb);
            return { 
                ...item, 
                hue: hsl.h, 
                lum: hsl.l, 
                sat: hsl.s 
            };
        });

        // Step 2: Build the table structure
        buildTable(data);

        const table = document.getElementById('colour-table');

        // Step 3: Define Custom Sorting Parsers
        // This handles "imm." as 0 and treats decimals correctly for HSL
        Tablesort.extend('number', function(item) { return true; }, function(a, b) {
            const clean = (val) => {
                if (val.toLowerCase().includes('imm')) return 0; 
                return parseFloat(val.replace(/[^\d.]/g, '')) || 9999;
            };
            return clean(a) - clean(b);
        });

        // Sorts by the rainbow order established in the Family column
        Tablesort.extend('family', function(item) { return true; }, function(a, b) {
            const familyOrder = {
                "reds": 1, "oranges": 2, "yellows": 3, "greens": 4, 
                "blues": 5, "purples": 6, "pinks": 7, "browns": 8, 
                "greys": 9, "neutrals": 10
            };
            return (familyOrder[a.toLowerCase().trim()] || 99) - (familyOrder[b.toLowerCase().trim()] || 99);
        });

        // Step 4: Initialize Tablesort and Refresh
        // Refresh is required because rows were added after page load
        const ts = new Tablesort(table);
        ts.refresh();

        // Step 5: Handle Dropdown Sort Trigger
        const sortSelect = document.getElementById('sort-select');
        sortSelect.addEventListener('change', function() {
            const headers = table.querySelectorAll('th');
            const colMap = {
                "Name": 0, "Hex": 2, "Year": 3, "Family": 4, 
                "Hue": 5, "Luminosity": 6, "Saturation": 7
            };
            const index = colMap[this.value];
            if (index !== undefined) ts.sortTable(headers[index]);
        });

        // Step 6: Search and Family Filter Logic
        const searchInput = document.getElementById('colour-search');
        const familyFilter = document.getElementById('family-filter');

        function filterTable() {
            const searchTerm = searchInput.value.toLowerCase().trim().replace('#', '');
            const selectedFamily = familyFilter.value.toLowerCase();
            const rows = document.querySelectorAll('#colour-table tbody tr');

            rows.forEach(row => {
                const name = row.cells[0].textContent.toLowerCase();
                const hex = row.cells[2].textContent.toLowerCase().replace('#', '');
                const family = row.cells[4].textContent.toLowerCase().trim(); 

                const matchesSearch = name.includes(searchTerm) || hex.includes(searchTerm);
                const matchesFamily = (selectedFamily === 'all' || family === selectedFamily);

                row.style.display = (matchesSearch && matchesFamily) ? '' : 'none';
            });
        }

        searchInput.addEventListener('input', filterTable);
        familyFilter.addEventListener('change', filterTable);
    }
});
