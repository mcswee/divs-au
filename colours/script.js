function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

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

function buildTable(data) {
    const tbody = document.querySelector("#colour-table tbody");
    if (!tbody) return;
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${item.Name}</td>
            <td style="background-color:${item.Hex}; width:2em;"></td>
            <td>${item.Hex}</td>
            <td>${item.Year}</td>
            <td style="display:none">${item.Family}</td>
            <td style="display:none">${item.hue}</td>
            <td style="display:none">${item.lum}</td>
            <td style="display:none">${item.sat}</td>
        </tr>
    `).join('');
}

Papa.parse("colours.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        const data = results.data.map(item => {
            const rgb = hexToRgb(item.Hex);
            const hsl = rgbToHsl(rgb);
            return { ...item, hue: hsl.h, lum: hsl.l, sat: hsl.s };
        });

        buildTable(data);

        const table = document.getElementById('colour-table');
        const ts = new Tablesort(table);

        // Dropdown Sort mapping
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

        // Search Filter (Name and Hex)
        const searchInput = document.getElementById('colour-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const filter = this.value.toLowerCase().replace('#', '');
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const name = row.cells[0].textContent.toLowerCase();
                    const hex = row.cells[2].textContent.toLowerCase().replace('#', '');
                    row.style.display = (name.includes(filter) || hex.includes(filter)) ? '' : 'none';
                });
            });
        }
    }
});
