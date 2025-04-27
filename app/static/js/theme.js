/**
 * Theme toggling functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('themeToggle');
    
    // Check for saved theme preference or respect OS preference
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('darkTheme');
    
    // Function to enable dark theme
    function enableDarkTheme() {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.checked = true;
        localStorage.setItem('darkTheme', 'enabled');
    }
    
    // Function to disable dark theme
    function disableDarkTheme() {
        document.body.classList.remove('dark-theme');
        if (themeToggle) themeToggle.checked = false;
        localStorage.setItem('darkTheme', 'disabled');
    }
    
    // Initial theme setup based on saved preference or OS preference
    if (savedTheme === 'enabled') {
        enableDarkTheme();
    } else if (savedTheme === 'disabled') {
        disableDarkTheme();
    } else if (prefersDarkScheme.matches) {
        // If no saved preference, use OS preference
        enableDarkTheme();
    }
    
    // Listen for theme toggle changes
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                enableDarkTheme();
            } else {
                disableDarkTheme();
            }
        });
    }
    
    // Listen for OS theme changes
    prefersDarkScheme.addEventListener('change', function(e) {
        if (!localStorage.getItem('darkTheme')) {
            if (e.matches) {
                enableDarkTheme();
            } else {
                disableDarkTheme();
            }
        }
    });
});