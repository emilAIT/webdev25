/**
 * Theme functionality (light theme only)
 */

document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('themeToggle');
    
    // Always use light theme and keep the toggle disabled
    function enforceLightTheme() {
        document.body.classList.remove('dark-theme');
        if (themeToggle) {
            themeToggle.checked = false;
            themeToggle.disabled = true; // Disable the theme toggle
        }
        localStorage.setItem('darkTheme', 'disabled');
    }
    
    // Always enforce light theme
    enforceLightTheme();
    
    // If the toggle exists, make it disabled
    if (themeToggle) {
        themeToggle.addEventListener('change', function(e) {
            // Prevent toggling by canceling the event and resetting to unchecked
            e.preventDefault();
            this.checked = false;
            return false;
        });
    }
});