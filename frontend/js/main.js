const chips = document.querySelectorAll(".chip");
const chatItems = document.querySelectorAll(".chat-item");

const searchInput = document.querySelector(".search");

let currentFilter = "all"; // default chip filter

// Apply both chip and search filters
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase();

  chatItems.forEach((item) => {
    const isGroup = item.classList.contains("group");

    const h1 = item.querySelector(".info .title h1");
    const name = h1?.textContent || "";
    const nameLower = name.toLowerCase();

    const matchesFilter =
      currentFilter === "all" || (currentFilter === "groups" && isGroup);
    const matchesSearch = nameLower.includes(searchTerm);

    // Highlight matching part in h1
    if (matchesSearch && searchTerm.length > 0) {
      const startIndex = nameLower.indexOf(searchTerm);
      const endIndex = startIndex + searchTerm.length;

      const highlighted =
        name.substring(0, startIndex) +
        `<span class="highlight">${name.substring(
          startIndex,
          endIndex
        )}</span>` +
        name.substring(endIndex);

      h1.innerHTML = highlighted;
    } else {
      h1.textContent = name; // reset if no match
    }

    item.style.display = matchesFilter && matchesSearch ? "flex" : "none";
  });
}

searchInput.addEventListener("input", applyFilters);

chatItems.forEach((item) => {
  item.addEventListener("click", () => {
    chatItems.forEach((c) => c.classList.remove("active"));
    item.classList.add("active");
  });
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");

    currentFilter = chip.textContent.trim().toLowerCase();
    applyFilters();
  });
});
