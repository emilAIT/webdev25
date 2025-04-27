/**
 * Search functionality
 */

/**
 * Setup search functionality
 */
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchContainer = document.querySelector('.search-container');
  
  if (!searchInput || !searchContainer) return;
  
  // Create search results container if it doesn't exist
  let searchResults = document.querySelector('.search-results');
  if (!searchResults) {
    searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    searchResults.style.display = 'none';
    searchContainer.parentNode.insertBefore(searchResults, searchContainer.nextSibling);
  }
  
  // Search with debounce
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);
    
    // If query is empty or too short, hide results
    if (!query || query.length < 2) {
      searchResults.style.display = 'none';
      return;
    }
    
    // Set delay before sending request
    searchTimeout = setTimeout(() => {
      searchUsers(query)
        .then(data => {
          // Clear results
          searchResults.innerHTML = '';
          
          if (data.users && data.users.length > 0) {
            // Add header
            const resultsHeader = document.createElement('div');
            resultsHeader.className = 'search-results-header';
            resultsHeader.textContent = 'Users';
            searchResults.appendChild(resultsHeader);
            
            // Add each user
            data.users.forEach(user => {
              const userItem = createSearchUserElement(user);
              searchResults.appendChild(userItem);
            });
            
            // Show results
            searchResults.style.display = 'block';
          } else {
            // Show "no results" placeholder
            const noResults = document.createElement('div');
            noResults.className = 'search-no-results';
            noResults.textContent = 'No users found';
            searchResults.appendChild(noResults);
            searchResults.style.display = 'block';
          }
        })
        .catch(error => {
          console.error('Search error:', error);
          
          // Show error message
          searchResults.innerHTML = '';
          const errorMsg = document.createElement('div');
          errorMsg.className = 'search-error';
          errorMsg.textContent = 'Search failed. Please try again.';
          searchResults.appendChild(errorMsg);
          searchResults.style.display = 'block';
        });
    }, 300);
  });
  
  // Hide search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && 
        !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
}

/**
 * Create search user element
 */
function createSearchUserElement(user) {
  const userItem = document.createElement('div');
  userItem.className = 'search-user-item';
  userItem.dataset.userId = user.id;
  
  // User avatar
  const userAvatar = document.createElement('div');
  userAvatar.className = 'search-user-avatar';
  
  if (user.avatar_path) {
    userAvatar.innerHTML = `<img src="${user.avatar_path}" alt="${user.name}">`;
  } else {
    userAvatar.innerHTML = `<div class="avatar-initials">${user.name.charAt(0)}</div>`;
  }
  
  // User info
  const userInfo = document.createElement('div');
  userInfo.className = 'search-user-info';
  
  const userName = document.createElement('div');
  userName.className = 'search-user-name';
  userName.textContent = user.name;
  
  const userBio = document.createElement('div');
  userBio.className = 'search-user-bio';
  userBio.textContent = user.bio || 'No information';
  
  // Assemble elements
  userInfo.appendChild(userName);
  userInfo.appendChild(userBio);
  
  userItem.appendChild(userAvatar);
  userItem.appendChild(userInfo);
  
  // Add click handler
  userItem.addEventListener('click', () => {
    // Reset search
    document.getElementById('searchInput').value = '';
    document.querySelector('.search-results').style.display = 'none';
    
    // Open chat
    openChatWithUser(user.id, user.name);
  });
  
  return userItem;
}
