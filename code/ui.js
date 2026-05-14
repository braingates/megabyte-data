import { OrderService, formatMoney, getFlash } from "./api.js";

function qs(selector) {
  return document.querySelector(selector);
}

function statusClass(status) {
  return `status ${String(status || "pending").toLowerCase()}`;
}

let globalApplyFilters = null;

function showFlash(message, type = "success") {
  if (!message) return;

  let flash = qs("#flashMessage");
  if (flash) flash.remove();

  flash = document.createElement("div");
  flash.id = "flashMessage";
  flash.className = `flash-message ${type.toLowerCase()}`;
  flash.textContent = message;
  document.body.appendChild(flash);

  // Force a reflow for transition
  flash.offsetHeight;

  setTimeout(() => {
    flash.classList.add("is-hiding");
    flash.addEventListener("transitionend", () => {
      flash.remove();
    }, { once: true });
    // Fallback if transitionend doesn't fire
    setTimeout(() => flash.remove(), 500);
  }, 5000);
}

/**
 * Sets the global loading state or a specific button loading state
 */
function setLoading(isLoading, buttonId = null) {
  const globalLoader = qs("#globalLoader");
  if (!buttonId && globalLoader) {
    globalLoader.classList.toggle("hidden", !isLoading);
    return;
  }

  const btn = qs(buttonId);
  if (btn) {
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || "Confirm";
      btn.disabled = false;
    }
  }
}

/**
 * Standardized way to show order status updates in the modal
 */
function updateOrderModal(title, message, type = "info") {
  const modal = qs("#orderModal");
  const titleEl = qs("#modalTitle");
  const msgEl = qs("#modalMessage");
  
  if (!modal || !titleEl || !msgEl) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  modal.classList.remove("hidden", "success", "failed", "processing");
  modal.classList.add("flex", type);
}

function renderTrackResults(orders) {
  const result = qs("#trackResult");
  if (!result) return;

  if (!orders.length) {
    result.innerHTML = "<p>No order found for that phone number or reference.</p>";
    return;
  }

  result.innerHTML = `
    <div class="table-wrapper">
      <table class="track-table">
        <thead>
          <tr>
            <th>Track ID</th>
            <th>Network</th>
            <th>Bundle</th>
            <th>Phone</th>
            <th>Payment</th>
            <th>Processing</th>
            <th>Delivery</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((order) => `
            <tr>
              <td><strong>${order.reference || order.trackingId || '-'}</strong></td>
              <td>${order.network}</td>
              <td>${order.bundle}</td>
              <td>${order.phone || order.recipientNumber}</td>
              <td class="${statusClass(order.paymentStatus)}">${order.paymentStatus}</td>
              <td class="${statusClass(order.processingStatus)}">${order.processingStatus}</td>
              <td class="${statusClass(order.deliveryStatus)}">${order.deliveryStatus}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function bindTracking() {
  const input = qs("#trackSearchInput");
  const button = qs("#trackSearchBtn");

  if (!input || !button) return;

  const runSearch = () => renderTrackResults(OrderService.search(input.value));

  button.addEventListener("click", runSearch);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });

  window.setInterval(() => {
    if (input.value.trim()) runSearch(); // Poll for updates if search term is active
  }, 15000); // Refresh every 15 seconds
}

function bindNavigation() {
  const menuToggle = qs("#menuToggle");
  const navLinks = qs("#navLinks");

  menuToggle?.addEventListener("click", () => {
    menuToggle.classList.toggle("active");
    navLinks?.classList.toggle("active");
  });
}

function showNetworkBundles(networkId, skipScroll = false) {
  const filter = qs("#networkFilter");
  const networkNameMap = {
    mtn: "MTN",
    telecel: "Telecel",
    airteltigo: "AirtelTigo",
  };

  if (filter) filter.value = networkNameMap[networkId] || "MTN";

  // Always trigger filter update to ensure section visibility
  if (globalApplyFilters) globalApplyFilters();

  localStorage.setItem("activeNetworkTab", networkId);

  if (!skipScroll) {
    const target = qs(`#${networkId}`) || qs(`.${networkId}-section`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bindNetworkTabs() {
  const bind = (selector, id) => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener("click", () => showNetworkBundles(id));
    });
  };

  bind(".mtn-network", "mtn");
  bind(".telecel-network", "telecel");
  bind(".airteltigo-network", "airteltigo");
}

function bindTabs() {
  const tabButtons = [...document.querySelectorAll("[data-tab]")];
  if (!tabButtons.length) return;

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tab;
      if (!tabId) return;

      tabButtons.forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((panel) => {
        panel.classList.toggle("active", panel.id === tabId);
      });

      button.classList.add("active");
    });
  });
}

function bindBundleSearch() {
  const input = qs("#searchInput");
  const filter = qs("#networkFilter");
  const bundles = [...document.querySelectorAll(".bundle")];
  const sections = [...document.querySelectorAll(".bundle-section")];
  const cards = [...document.querySelectorAll(".network")];

  globalApplyFilters = () => {
    const term = input?.value.trim().toLowerCase() || "";
    const networkNameMap = { mtn: "MTN", telecel: "Telecel", airteltigo: "AirtelTigo" };
    const savedTab = localStorage.getItem("activeNetworkTab") || "mtn";
    const network = filter?.value || networkNameMap[savedTab] || "MTN";

    // Toggle sections visibility based on network filter
    sections.forEach((section) => {
      const sectionId = section.id.toLowerCase();
      const isMatch = network === "all" || sectionId.includes(network.toLowerCase());
      section.style.display = isMatch ? "flex" : "none";
    });

    // Update active icon highlight
    cards.forEach((card) => {
      const cardType = card.classList.contains("mtn-network") ? "MTN" :
                       card.classList.contains("telecel-network") ? "Telecel" :
                       card.classList.contains("airteltigo-network") ? "AirtelTigo" : "";
      card.classList.toggle("active-network", network !== "all" && cardType === network);
    });

    bundles.forEach((bundle) => {
      const text = bundle.textContent.toLowerCase();
      const bundleNetwork = bundle.querySelector("h2")?.textContent.trim() || "";
      const matchesText = !term || text.includes(term);
      const matchesNetwork = network === "all" || bundleNetwork.toLowerCase().includes(network.toLowerCase());
      bundle.style.display = matchesText && matchesNetwork ? "" : "none";
    });
  };

  input?.addEventListener("input", globalApplyFilters);
  filter?.addEventListener("change", globalApplyFilters);
}

function bindTheme() {
  const toggle = qs("#themeToggle") || qs(".theme-toggle");
  const nav = qs("nav");
  if (!toggle) return;

  const updateTheme = (isLight) => {
    document.body.classList.toggle("light-theme", isLight);
    nav?.classList.toggle("light-theme", isLight);
    localStorage.setItem("megabyteStationTheme", isLight ? "light" : "dark");
  };

  const savedTheme = localStorage.getItem("megabyteStationTheme");
  updateTheme(savedTheme === "light");

  toggle.addEventListener("click", () => {
    const isLight = !document.body.classList.contains("light-theme");
    updateTheme(isLight);
  });
}

function renderRecentOrders(targetSelector = "#recentOrdersList") {
  const target = qs(targetSelector);
  const emptyState = qs("#ordersEmptyState");
  if (!target) return;

  const orders = OrderService.getOrders().slice(0, 10);
  
  // Toggle the static empty state element if it exists (used in orders.html)
  if (emptyState) {
    emptyState.style.display = orders.length ? "none" : "block";
  }

  if (!orders.length) {
    target.innerHTML = ''; // Keep clear if using static emptyState element
    return;
  }

  target.innerHTML = orders.map((order) => `
    <article class="customer-order-card">
      <div class="customer-order-top">
        <span class="order-network">${order.network}</span>
        <small>${new Date(order.createdAt).toLocaleDateString()}</small>
      </div>
      <div><strong>${order.network}</strong> ${order.bundle}</div>
      <div>${order.phone || order.recipientNumber} - ${formatMoney(order.totalAmount || order.amount)}</div>
      <div class="status-row">
        <span class="${statusClass(order.paymentStatus)}">${order.paymentStatus}</span>
        <span class="${statusClass(order.orderStatus)}">${order.orderStatus}</span>
      </div>
    </article>
  `).join("");
}

function bindLiveStatus() {
  const timerEl = qs("#liveTimer") || qs(".live-timer");
  if (!timerEl) return;

  const update = () => {
    const now = new Date();
    timerEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  update();
  setInterval(update, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindNetworkTabs();
  bindTabs();
  bindBundleSearch();
  bindTracking();
  bindTheme();
  bindLiveStatus();
  
  const savedTab = localStorage.getItem("activeNetworkTab") || "mtn";
  showNetworkBundles(savedTab, true);

  const flash = getFlash();
  if (flash) showFlash(flash.message, flash.type);
});

export { renderRecentOrders, showFlash, setLoading, updateOrderModal };
