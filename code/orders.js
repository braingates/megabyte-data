import { formatMoney, OrderService } from "./api.js";
import OrderTracker from "./orderTracker.js";

const scroller = document.querySelector("#ordersCardScroller");
const emptyState = document.querySelector("#ordersEmptyState");
const input = document.querySelector("#ordersSearchInput");
const button = document.querySelector("#ordersSearchBtn");
const savedLookup = localStorage.getItem("megabyteStationCustomerLookup") || "";
// Input should be empty by default until customer searches
// input.value = savedLookup; // Removed

let currentTracker = null;

function statusClass(status) {
  const s = String(status || "pending").toLowerCase();
  return `status ${s}${['completed', 'success', 'delivered'].includes(s) ? ' status-success' : ''}`;
}

function formatStatusText(status) {
  if (!status) return "Pending";
  const s = String(status).toLowerCase();
  if (s === 'completed' || s === 'delivered' || s === 'success') return 'Delivered';
  if (s === 'pending_vendor_balance') return 'Pending Vendor Balance';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Main function to manage the OrderTracker lifecycle and trigger UI updates.
 * This is called when the search button is clicked or Enter is pressed.
 */
async function handleSearch() {
  const query = input.value.trim();

  if (query && !currentTracker) {
    // Initialize tracker only once per query
    currentTracker = new OrderTracker(query, updateUIWithOrders);
    currentTracker.init();
    localStorage.setItem("megabyteStationCustomerLookup", query); // Save lookup
  } else if (query && currentTracker && currentTracker.query !== query) {
    // If query changes, destroy old tracker and create a new one
    currentTracker.destroy();
    currentTracker = new OrderTracker(query, updateUIWithOrders);
    currentTracker.init();
    localStorage.setItem("megabyteStationCustomerLookup", query); // Save lookup
  } else if (!query) {
    // If query is empty, clear everything
    if (currentTracker) {
      currentTracker.destroy();
      currentTracker = null;
    }
    OrderService.writeOrders([]); // Clear local storage for customer view
    localStorage.removeItem("megabyteStationCustomerLookup"); // Clear lookup
    updateUIWithOrders([]); // Clear UI immediately
  }
  // If query is the same and tracker exists, no action needed here,
  // tracker's polling/socket will handle updates.
}

/**
 * Renders the orders to the UI. This is the callback for OrderTracker.
 * @param {Array} orders - The list of orders to display.
 */
function renderOrders(orders) {
  const query = input.value.trim(); // Get current query for empty state message

  if (!orders.length) {
    // Show empty state if no orders are provided or found
    // The message depends on whether a query was entered
    emptyState.textContent = query
      ? "No recent orders found for your search."
      : "Enter your phone number or order reference to view your recent orders.";
    emptyState.style.display = "block";
    scroller.innerHTML = "";
    return;
  }
  
  emptyState.style.display = "none";
  scroller.innerHTML = orders.map((order) => {
    const isCompleted = order.orderStatus === 'completed';
    const reportMsg = encodeURIComponent(
      `Hello Admin, I am reporting an order.\n\n` +
      `Issue: Completed but not received\n` +
      `Reference: ${order.reference || order.shortTrackingId || 'N/A'}\n` +
      `Network: ${order.network || 'N/A'}\n` +
      `Bundle: ${order.bundle || 'N/A'}\n` +
      `Phone: ${order.phone || 'N/A'}`
    );
    const waLink = `https://wa.me/233506932474?text=${reportMsg}`;

    return `
    <article class="customer-order-card" style="position: relative;">
      ${order.orderStatus === 'completed' || order.orderStatus === 'delivered' || order.orderStatus === 'success' ? '<div class="completion-badge">✓ Delivered</div>' : ''}
      ${isCompleted ? `<a href="${waLink}" target="_blank" class="report-order-whatsapp" style="position: absolute; top: 10px; right: 10px; background: #25D366; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 4px; z-index: 10;"><i class="fab fa-whatsapp"></i> Report Order</a>` : ''}
      <div class="customer-order-top">
        <span class="order-network">${order.network}</span>
        <span class="${statusClass(order.paymentStatus)}">${['completed', 'success'].includes(String(order.paymentStatus).toLowerCase()) ? 'Successful' : order.paymentStatus}</span>
      </div>

      <h2>${order.bundle}</h2>

      <dl>
        <div>
          <dt>Recipient</dt>
          <dd>${order.phone}</dd>
        </div>
        <div>
          <dt>Amount Paid</dt>
          <dd>${formatMoney(order.amount)}</dd>
        </div>
         <div>
          <dt>Bundle</dt>
          <dd>${order.bundle}</dd>
        </div>
        <div>
          <dt>Order Status</dt>
          <dd class="${statusClass(order.orderStatus)}">${formatStatusText(order.orderStatus)}</dd>
        </div>
        ${order.completedAt ? `
        <div>
          <dt>Delivered On</dt>
          <dd>${new Date(order.completedAt).toLocaleString()}</dd>
        </div>` : ''}
  
      </dl>

      <footer>
        <div class="order-ids" style="display: flex; flex-direction: column; gap: 2px;">
          <span>Ref: ${order.shortTrackingId || 'N/A'}</span>
        
        </div>
        <time style="margin-top: 5px; display: block;">${new Date(order.createdAt).toLocaleString()}</time>
      </footer>
    </article>
  `;}).join("");
}

function updateUIWithOrders(orders) {
  renderOrders(orders); // This is the only place renderOrders should be called with data
}

button.addEventListener("click", handleSearch);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleSearch();
});

// Initial state: show empty message, do not auto-load orders
// The input field is already empty by default due to removing input.value = savedLookup;
emptyState.textContent = "Enter your phone number or order reference to view your recent orders.";
emptyState.style.display = "block";
scroller.innerHTML = "";
