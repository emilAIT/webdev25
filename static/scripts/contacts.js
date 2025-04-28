function toggleMenu() {
            const menu = document.getElementById("dropdown");
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        }

        document.addEventListener("click", function (event) {
            const menu = document.getElementById("dropdown");
            const button = document.querySelector(".menu-button");
            if (!button.contains(event.target) && !menu.contains(event.target)) {
                menu.style.display = "none";
            }
        });
    
function setActive(selected) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        selected.classList.add('active');
        // Future functionality: Filter contacts based on selection (All, Online, Favorites)
    }

async function fetchContacts() {
    try {
        const response = await fetch("/api/contacts", {
            headers: { "Content-Type": "application/json" }
        });
        if (response.ok) {
            const contacts = await response.json();
            renderContacts(contacts);
        }
    } catch (error) {
        console.error('Error fetching contacts:', error);
    }
}

function renderContacts(contacts) {
    const contactsList = document.querySelector('.contacts-list');
    contactsList.innerHTML = contacts.map(contact => `
        <div class="contact">
            <div class="contact-avatar">${contact.contact_name[0].toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.contact_name}</div>
                <div class="contact-status">Offline</div>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', fetchContacts);
