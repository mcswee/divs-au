Papa.parse('us-flags.csv', {
    download: true,
    header: true,
    complete: function(results) {
        const gallery = document.getElementById('flag-gallery');
        const select = document.getElementById('state-jump');
        let html = '';

        results.data.forEach(row => {
            if (!row.Abbr) return;

            // 1. Populate Dropdown
            const opt = document.createElement('option');
            opt.value = `#${row.Abbr}`;
            opt.textContent = row.State;
            select.appendChild(opt);

            // 2. Determine Flag Layout
            let flagHTML = '';
            const currentPath = `current/${row.Abbr}.svg`;
            const redesignPath = `redesign/${row.Abbr}.svg`;

            if (row.Status === 'No Change') {
                flagHTML = `<div class="flag-single"><img src="${currentPath}"></div>`;
            } else if (row.Abbr === 'OR') {
                flagHTML = `
                    <div class="flag-compare">
                        <img src="current/OR-front.svg" title="${row.State} current flag - front">
                        <img src="current/OR-back.svg" title="${row.State} current flag - back">
                        <img src="${redesignPath}" title="${row.State} redesign">
                    </div>`;
            } else {
                flagHTML = `
                    <div class="flag-compare">
                        <img src="${currentPath}" title="${row.State} current flag">
                        <img src="${redesignPath}" title="${row.State} redesign">
                    </div>`;
            }

            // 3. Build the Section
            html += `
                <section class="state-section" id="${row.Abbr}">
                    <h3>${row.State}</h3>
                    ${flagHTML}
                    <p class="commentary">${row.Commentary}</p>
                    <p class="copyright">${row.Copyright}</p>
                </section>`;
        });

        gallery.innerHTML = html;

        // Dropdown Event Listener
        select.addEventListener('change', function() {
            if (this.value) window.location.hash = this.value;
        });
  
    }
});
