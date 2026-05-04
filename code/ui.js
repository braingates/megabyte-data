// ==========================
// UI MODULE (PRODUCTION SAFE)
// ==========================

console.log("UI module loaded");

// ==========================
// DOM CACHE (PERFORMANCE)
// ==========================
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

const sections = {
  mtn: document.getElementById("mtn"),
  telecel: document.getElementById("telecel"),
  airteltigo: document.getElementById("airteltigo")
};

const networkCards = {
  mtn: document.querySelector(".mtn-network"),
  telecel: document.querySelector(".telecel-network"),
  airteltigo: document.querySelector(".airteltigo-network")
};

const themeToggle = document.getElementById("themeToggle");

// ==========================
// NAVIGATION
// ==========================
menuToggle?.addEventListener("click", () => {
  navLinks?.classList.toggle("active");
  menuToggle.classList.toggle("active");
});

document.querySelectorAll("#navLinks a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    menuToggle?.classList.remove("active");
  });
});

// ==========================
// TAB SWITCHING (SAFE)
// ==========================
export function switchTab(network) {
  if (!sections[network]) {
    console.warn(`Invalid network tab: ${network}`);
    return;
  }

  // Hide all sections
  Object.values(sections).forEach(section => {
    if (section) section.style.display = "none";
  });

  // Show selected
  sections[network].style.display = "flex";

  // Update active card
  Object.values(networkCards).forEach(card => {
    card?.classList.remove("active-network");
  });

  networkCards[network]?.classList.add("active-network");

  // 💾 Persist selection
  localStorage.setItem("activeNetwork", network);
}

// ==========================
// TAB EVENTS
// ==========================
networkCards.mtn?.addEventListener("click", () => switchTab("mtn"));
networkCards.telecel?.addEventListener("click", () => switchTab("telecel"));
networkCards.airteltigo?.addEventListener("click", () => switchTab("airteltigo"));

// ==========================
// RESTORE LAST TAB
// ==========================
const savedTab = localStorage.getItem("activeNetwork") || "mtn";
switchTab(savedTab);

/*
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {

    // remove active state
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");

    // activate clicked tab
    btn.classList.add("active");
    const target = btn.dataset.tab;
    document.getElementById(target).style.display = "block";
  });
});
*/
// ==========================
// THEME SYSTEM (ROBUST)
// ==========================
function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
}

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "dark";
applyTheme(savedTheme);

// Toggle theme
themeToggle?.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-theme");

  const newTheme = isLight ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
});



document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const networkFilter = document.getElementById("networkFilter");

  const bundles = document.querySelectorAll(".bundle");

  function filterBundles() {
    const search = (searchInput?.value || "").toLowerCase().trim();
    const network = networkFilter?.value || "all";

    bundles.forEach(bundle => {
      const text = bundle.innerText;//toLowerCase();

      const bundleNetwork = bundle.querySelector("h2")?.innerText.trim();

      const matchesSearch =
        text.includes(search) || search === "";

      const matchesNetwork =
        network === "all" || bundleNetwork === network;

      if (matchesSearch && matchesNetwork) {
        bundle.style.display = "block";
      } else {
        bundle.style.display = "none";
      }
    });
  }

  searchInput?.addEventListener("input", filterBundles);
  networkFilter?.addEventListener("change", filterBundles);

  // run once on load
  filterBundles();
});