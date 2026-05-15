import { ADMIN_REFRESH_MS, OrderService, formatMoney } from "./api.js";

const totalOrders = document.querySelector("#total");
const success = document.querySelector("#success");
const failed = document.querySelector("#failed");
const pendingPayments = document.querySelector("#pendingPayments");
const revenue = document.querySelector("#revenue");
const profit = document.querySelector("#profit");
const searchInput = document.querySelector("#searchInput");
const networkFilter = document.querySelector("#networkFilter");
const statusFilter = document.querySelector("#statusFilter");
const refreshBtn = document.querySelector("#refreshBtn");
const tableBody = document.querySelector("#tableBody");

function statusClass(status) {
  return `status ${String(status || "pending").toLowerCase()}`;
}

function stringifyVendorData(value) {
  if (!value) return "";
  return JSON.stringify(value);
}

const vendorCostRates = {
  MTN: 0.88,
  Telecel: 0.86,
  AirtelTigo: 0.84,
};

function estimateProfit(order) {
  if (order.paymentStatus !== "completed") return 0;

  // Use actual vendorCost from the backend if available, otherwise estimate
  const actualVendorCost = order.vendorCost || (Number(order.amount || 0) * (vendorCostRates[order.network] || 0.87));
  const customerAmount = Number(order.amount || 0);
  
  return Number((customerAmount - actualVendorCost).toFixed(2));
}

function getFilteredOrders() {
  const term = searchInput.value.trim().toLowerCase();
  const network = networkFilter.value;
  const status = statusFilter.value;

  return OrderService.getOrders().filter((order) => { // This will now filter from locally cached orders
    const matchesTerm = !term || [
      order.reference,
      order.transactionReference,
      order.recipientNumber,
      order.network,
      order.bundle,
    ].some((value) => String(value || "").toLowerCase().includes(term));

    const matchesNetwork = !network || order.network === network;
    const matchesStatus = !status || [order.orderStatus, order.processingStatus, order.paymentStatus].includes(status);

    return matchesTerm && matchesNetwork && matchesStatus;
  });
}

async function renderDashboard() {
  // Fetch latest orders from backend
  await OrderService.fetchOrders(); // This updates the local storage

  const orders = getFilteredOrders();
  const successfulOrders = orders.filter((order) => order.paymentStatus === "completed");
  const failedOrders = orders.filter((order) => order.paymentStatus === "failed" || order.orderStatus === "failed" || order.processingStatus === "failed");
  const pendingPaymentOrders = orders.filter((order) => order.paymentStatus === "pending");
  const totalRevenue = successfulOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const totalProfit = successfulOrders.reduce((sum, order) => sum + estimateProfit(order), 0);

  totalOrders.textContent = String(orders.length);
  success.textContent = String(successfulOrders.length);
  failed.textContent = String(failedOrders.length);
  pendingPayments.textContent = String(pendingPaymentOrders.length);
  revenue.textContent = formatMoney(totalRevenue); // Renamed 'total' to 'totalOrders' to avoid conflict
  profit.textContent = formatMoney(totalProfit);

  if (!orders.length) {
    tableBody.innerHTML = `<tr><td colspan="12">No orders found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = orders.map((order) => `
    <tr title="Vendor request: ${stringifyVendorData(order.vendorRequestData)} | Vendor response: ${stringifyVendorData(order.vendorResponse)}">
      <td>${order.reference}<br><small>Track: <strong>${order.vendorReference || order.trackingId || '-'}</strong></small></td>
      <td>${order.network}</td>
      <td>${order.bundle}</td>
      <td>${order.recipientNumber}</td>
      <td>${formatMoney(order.totalAmount)}</td>
      <td>${formatMoney(estimateProfit(order))}</td>
      <td><span class="${statusClass(order.paymentStatus)}">${order.paymentStatus}</span></td>
      <td>${order.vendorService || ""}<br><small>Retries: ${order.retryCount}/${order.maxRetries}</small></td>
      <td><span class="${statusClass(order.processingStatus)}">${order.processingStatus}</span></td>
      <td><span class="${statusClass(order.deliveryStatus)}">${order.deliveryStatus}</span></td>
      <td>${order.vendorError || ""}</td>
      <td>${new Date(order.createdAt).toLocaleString()}</td>
    </tr>
  `).join("");
}

refreshBtn.addEventListener("click", renderDashboard);
searchInput.addEventListener("input", renderDashboard);
networkFilter.addEventListener("change", renderDashboard);
statusFilter.addEventListener("change", renderDashboard);

renderDashboard();
window.setInterval(renderDashboard, ADMIN_REFRESH_MS);
window.addEventListener("orders:updated", renderDashboard);
