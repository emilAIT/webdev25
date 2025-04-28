const chatData = {
        "Friend1": { type: "user", status: "Online", phone: "+1 (555) 123-4567", bio: "Chat enthusiast" },
        "Friend2": { type: "user", status: "Offline", phone: "+1 (555) 234-5678", bio: "Coffee lover" },
        "Friend3": { type: "user", status: "Away", phone: "+1 (555) 345-6789", bio: "Tech geek" },
        "Friend4": { type: "group", status: "Group", members: ["Alice", "Bob", "Charlie"] },
        "Friend5": { type: "user", status: "Online", phone: "+1 (555) 567-8901", bio: "Music fan" }
    };

    function setActive(selected) {
        document.querySelectorAll('.user-info').forEach(el => el.classList.remove('active'));
        selected.classList.add('active');
        const name = selected.dataset.name;
        document.getElementById("username-id").innerHTML = name;
        updateInfoPanel(name);
    }

    function openSystemEmojiPicker() {
        const input = document.querySelector(".chat-input");
        input.focus();
    }

    function getCurrentDateTime() {
        const now = new Date();
        return now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    function sendMessage() {
        const input = document.querySelector(".chat-input");
        if (input.value.trim()) {
            const chatDisplay = document.querySelector(".mid-chat-display");
            const message = document.createElement("div");
            message.classList.add("message", "sent");
            message.innerHTML = `
                <div class="message-content">${input.value.trim()}</div>
                <span class="message-timestamp">${getCurrentDateTime()}</span>
            `;
            chatDisplay.appendChild(message);
            input.value = "";
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }
    }

    document.querySelector(".chat-input").addEventListener("keypress", function (e) {
        if (e.key === "Enter" && this.value.trim()) {
            sendMessage();
        }
    });

    function toggleInfoPanel() {
        const panel = document.getElementById("infoPanel");
        panel.classList.toggle("active");
    }

    function updateInfoPanel(name) {
        const data = chatData[name] || { type: "user", status: "Unknown", phone: "N/A", bio: "No info available" };
        document.getElementById("infoTitle").textContent = name;
        document.getElementById("infoAvatar").textContent = name[0].toUpperCase();
        document.getElementById("infoStatus").textContent = data.status;
        document.getElementById("infoPhone").textContent = data.phone || "N/A";
        document.getElementById("infoBio").textContent = data.bio || "No bio";

        const groupMembers = document.getElementById("groupMembers");
        if (data.type === "group" && data.members) {
            groupMembers.style.display = "block";
            const memberList = document.querySelector(".member-list");
            memberList.innerHTML = data.members.map(member => `
                <li class="member-item">
                    <span class="member-avatar">${member[0].toUpperCase()}</span>${member}
                </li>
            `).join("");
        } else {
            groupMembers.style.display = "none";
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const firstUser = document.querySelector(".user-info");
        if (firstUser) {
            setActive(firstUser);
        }
    });