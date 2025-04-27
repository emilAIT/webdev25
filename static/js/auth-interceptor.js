// Auth interceptor to add Authorization header to all fetch requests
(function() {
    // Store original fetch function
    const originalFetch = window.fetch;

    // Override fetch with our own version that adds the token
    window.fetch = async function(url, options = {}) {
        // Get token from localStorage
        const token = localStorage.getItem('access_token');
        
        // Only add the Authorization header if we have a token
        if (token) {
            // Create headers if they don't exist
            options.headers = options.headers || {};
            
            // Add Authorization header with Bearer token
            if (typeof options.headers === 'object') {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
        }
        
        // Call original fetch with our modified options
        const response = await originalFetch(url, options);
        // If we get a 401 Unauthorized response, clear the token and redirect to login
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            // Only redirect if we're not already on the login page
            if (!window.location.pathname.includes('/')) {
                window.location.href = '/';
            }
        }
        return response;
    };
})();
