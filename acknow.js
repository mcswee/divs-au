document.addEventListener('DOMContentLoaded', function() {
    const banner = document.getElementById('ack-banner');
    
    // 1. Check if it should be hidden on page load
    if (localStorage.getItem('ackDismissed') === 'true') {
        if (banner) banner.style.display = 'none';
    }

    // 2. Set up the click logic
    const closeBtn = document.querySelector('.ack-close');
    if (closeBtn && banner) {
        closeBtn.addEventListener('click', function() {
            banner.style.display = 'none';
            localStorage.setItem('ackDismissed', 'true');
        });
    }
});
