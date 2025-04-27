import { getToken } from './authService.js';

const API_BASE_URL = 'http://127.0.0.1:8000'; // Centralize base URL

async function request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', // Default, override if needed
        ...options.headers,
    };

    // Don't send Content-Type header for GET/HEAD requests or if body is FormData/URLSearchParams
    if (!options.body || options.body instanceof FormData || options.body instanceof URLSearchParams) {
        delete headers['Content-Type'];
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: headers,
        });

        // Attempt to parse JSON regardless of status for error details
        let data = null;
        try {
           data = await response.json();
        } catch (e) {
             // Ignore if no body or not JSON
        }

        if (!response.ok) {
            // Throw an error object with status and detail
            throw { 
                status: response.status, 
                detail: data?.detail || response.statusText || 'Unknown API error' 
            };
        }
        console.log('API Response:', data); // Log the response data
        return data; // Return parsed JSON data on success
    } catch (error) {
        console.error(`API Error (${options.method || 'GET'} ${endpoint}):`, error);
        // Re-throw the structured error or a generic one
        throw error;
    }
}

export async function fetchCurrentUser() {
    return request('/users/me');
}

export async function fetchContacts() {
    return request('/contacts');
}

export async function addContact(username) {
    return request('/contacts', {
        method: 'POST',
        body: JSON.stringify({ username: username })
    });
}

export async function fetchConversationHistory(otherUserId) {
    return request(`/conversations/${otherUserId}`);
}

export async function fetchGroups() {
    return request('/users/me/groups');
}

export async function createGroup(groupName, description) {
    return request('/group/append', {
        method: 'POST',
        body: JSON.stringify({ group_name: groupName, description: description })
    });
}

export async function fetchGroupDetails(groupId) {
    return request(`/groups/${groupId}`);
}

export async function searchUsers(username) {
    return request(`/users/search?username=${encodeURIComponent(username)}`);
}

export async function addUserToGroup(groupId, userId) {
     return request(`/group/add_user/${groupId}`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
    });
}

export async function removeUserFromGroup(groupId, userId) {
     return request(`/group/delete_user/${groupId}/${userId}`, {
        method: 'DELETE'
    });
}

// --- NEW: Group Update Functions ---
export async function updateGroupDetails(groupId, name, description) {
    const payload = {};
    if (name !== undefined) payload.group_name = name; 
    if (description !== undefined) payload.description = description;

    return request(`/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
}

export async function uploadGroupAvatar(groupId, file) {
    const formData = new FormData();
    formData.append('file', file); // 'file' must match the backend FastAPI parameter name

    // Use the request helper, but override Content-Type as it's set by FormData
    return request(`/groups/${groupId}/avatar`, {
        method: 'POST',
        body: formData,
        // Content-Type header is removed by the request helper for FormData
    });
}

export async function leaveGroup(groupId) {
    return request(`/groups/${groupId}/leave`, {
        method: 'DELETE'
    });
}

export async function deleteGroup(groupId) {
     return request(`/group/delete/${groupId}`, {
        method: 'DELETE'
    });
}

// --- NEW: Delete Direct Chat History ---
export async function deleteDirectChat(otherUserId) {
    return request(`/conversations/${otherUserId}`, {
        method: 'DELETE'
    });
}

// --- END: Group Update Functions ---

// --- NEW: Media Upload Function ---
export async function uploadMediaFile(file) {
    const formData = new FormData();
    formData.append('file', file); // 'file' must match the backend FastAPI parameter name
    // Optional: Add folder category if needed by backend
    // formData.append('folder', 'chat_attachments'); 

    // Use the request helper, but override Content-Type as it's set by FormData
    return request('/upload-media', {
        method: 'POST',
        body: formData, 
        // Content-Type header is removed by the request helper for FormData
    });
}
// --- END: Media Upload Function ---