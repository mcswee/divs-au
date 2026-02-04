document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const siteNav = document.querySelector('.site-nav');

    // Only run if both elements exist on the page
    if (menuToggle && siteNav) {
        menuToggle.addEventListener('click', () => {
            const isActive = siteNav.classList.toggle('is-active');
            menuToggle.setAttribute('aria-expanded', isActive);
        });
    }
});
