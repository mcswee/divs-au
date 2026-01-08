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
                    <figure>
                        <img src="${currentPath}" alt="${row.State} current flag">
                        <figcaption>${row.State} flag retained</figcaption>
                    </figure>`;
            } else if (row.Abbr === 'OR') {
                flagHTML = `
                    <figure>
                        <img src="current/OR-front.svg" alt="${row.State} current flag front">
                        <figcaption>Current (Front)</figcaption>
                    </figure>
                    <figure>
                        <img src="current/OR-back.svg" alt="${row.State} current flag back">
                        <figcaption>Current (Back)</figcaption>
                    </figure>
                    <figure>
                        <img src="${redesignPath}" alt="${row.State} redesign">
                        <figcaption>Redesign</figcaption>
                    </figure>`;
            } else {
                flagHTML = `
                    <figure>
                        <img src="${currentPath}" alt="${row.State} current flag">
                        <figcaption>Current Flag</figcaption>
                    </figure>
                    <figure>
                        <img src="${redesignPath}" alt="${row.State} redesign">
                        <figcaption>Redesign</figcaption>
                    </figure>`;
            }
            
            // 3. Build the Section
            html += `
                <section class="state-section" id="${row.Abbr}">
                    <h3>${row.State}</h3>
                    <span class="flag-status status-${row.Status.toLowerCase().replace(/\s+/g, '-')}">${row.Status}</span>
                    <div class="flag-row">
                        ${flagHTML}
                    </div>
                    <div class="commentary">${row.Commentary}</div>
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
