document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.js-filter-container').forEach(container => {
    const input = container.querySelector('.js-filter-input');
    const clearBtn = container.querySelector('.js-filter-clear');
    const matchedDisplay = container.querySelector('.js-filter-matched');
    const totalDisplay = container.querySelector('.js-filter-total');
    const noResults = container.querySelector('.js-filter-no-results');
    const nav = document.querySelector('.alphabet-nav');
    
    const targetId = container.getAttribute('data-target');
    const grid = document.getElementById(targetId);
    
    if (!grid) return; 
    
    const items = grid.querySelectorAll('[data-search]');
    totalDisplay.textContent = items.length;

    const runFilter = () => {
      const query = input.value.toLowerCase().trim();
      let count = 0;

      items.forEach(item => {
        const terms = item.getAttribute('data-search').toLowerCase();
        const isMatch = terms.includes(query);
        item.hidden = !isMatch;
        if (isMatch) count++;
      });

      matchedDisplay.textContent = count;
      clearBtn.hidden = (query === "");
      if (noResults) noResults.hidden = (count > 0 || query === "");
      if (nav) nav.hidden = (query !== "");

      input.classList.toggle('search-error', count === 0 && query !== "");
    };

    input.addEventListener('input', runFilter);
    input.addEventListener('search', runFilter);
    clearBtn.addEventListener('click', () => {
      input.value = "";
      runFilter();
      input.focus();
    });

    runFilter();
  });
});
