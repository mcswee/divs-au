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
                flagHTML = `
                    <div class="flag-single">
                        <figure>
                            <img src="${currentPath}" alt="${row.State} current flag">
                            <figcaption>${row.State} current flag retained</figcaption>
                        </figure>
                    </div>`;
            } else if (row.Abbr === 'OR') {
                flagHTML = `
                    <div class="flag-compare">
                        <figure>
                            <img src="current/OR-front.svg" alt="${row.State} current flag">
                            <figcaption>${row.State} current flag</figcaption>
                        </figure>
                        <figure>
                            <img src="current/OR-back.svg" alt="${row.State} current flag (reverse)">
                            <figcaption>${row.State} current flag (reverse)</figcaption>
                        </figure>
                        <figure>
                            <img src="${redesignPath}" alt="${row.State} redesigned flag">
                            <figcaption>My proposed ${row.State} flag</figcaption>
                        </figure>
                    </div>`;
            } else {
                flagHTML = `
                    <div class="flag-compare">
                        <figure>
                            <img src="${currentPath}" alt="${row.State} current flag">
                            <figcaption>${row.State} current flag </figcaption>
                        </figure>
                        <figure>
                            <img src="${redesignPath}" alt=${row.State} redesigned flag">
                            <figcaption>My proposed ${row.State} flag</figcaption>
                        </figure>
                    </div>`;
            }

            // 3. Build the Section
            html += `
                <section class="state-section" id="${row.Abbr}">
                    <h3>${row.State}</h3>
                    <span class="flag-status>$(row.Status)</span>
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
