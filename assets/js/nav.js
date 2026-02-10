Document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const siteNav = document.querySelector('.site-nav');

    if (menuToggle && siteNav) {
        // Toggle on click
        menuToggle.addEventListener('click', () => {
            const isActive = siteNav.classList.toggle('is-active');
            menuToggle.setAttribute('aria-expanded', isActive);
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && siteNav.classList.contains('is-active')) {
                siteNav.classList.remove('is-active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.focus(); 
            }
        });
    }
});
