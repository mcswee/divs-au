function dismissAck() {
    // Hide the element immediately
    document.getElementById('ack-banner').style.display = 'none';
    // Remember this choice for 30 days (or until they clear cache)
    localStorage.setItem('ackDismissed', 'true');
}

// Check on page load if it should be hidden
window.onload = function() {
    if (localStorage.getItem('ackDismissed') === 'true') {
        const banner = document.getElementById('ack-banner');
        if (banner) {
            banner.style.display = 'none';
        }
    }
};
