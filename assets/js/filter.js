document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.js-filter-container').forEach(container => {
    const input = container.querySelector('.js-filter-input');
    const clearBtn = container.querySelector('.js-filter-clear');
    const noResultsElements = document.querySelectorAll('.js-filter-no-results');
    const nav = document.querySelector('.alphabet-nav');
    
    const targetId = container.getAttribute('data-target');
    const grid = document.getElementById(targetId);
    
    if (!grid) return; 
    
    const items = grid.querySelectorAll('.js-search-item');
    const matchedDisplays = document.querySelectorAll('.js-filter-matched');
    const totalDisplays = document.querySelectorAll('.js-filter-total');

    // Initialize totals
    totalDisplays.forEach(el => el.textContent = items.length);
    matchedDisplays.forEach(el => el.textContent = items.length);

    const runFilter = () => {
      const query = input.value.toLowerCase().trim();
      let count = 0;

      items.forEach(item => {
        const terms = item.getAttribute('data-search').toLowerCase();
        const isMatch = terms.includes(query);
        item.hidden = !isMatch;
        if (isMatch) count++;
      });

      // Update all counters on the page
      matchedDisplays.forEach(el => el.textContent = count);
      
      // Toggle UI elements
      clearBtn.hidden = (query === "");
      noResultsElements.forEach(el => el.hidden = (count > 0 || query === ""));
      
      if (nav) {
        nav.hidden = (query !== "");
      }

      input.classList.toggle('search-error', count === 0 && query !== "");
    };

    input.addEventListener('input', runFilter);
    input.addEventListener('search', runFilter);
    
    clearBtn.addEventListener('click', () => {
      input.value = "";
      runFilter();
      input.focus();
    });

    // Run once on load to sync initial state
    runFilter();
  });
});
