import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

// Fallback to localhost if developing locally to prevent ERR_NAME_NOT_RESOLVED
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? `http://${window.location.hostname}:5001/api`
  : "https://data-bundle-backend.onrender.com/api";

console.log("🔌 API Base:", API_BASE);
console.log("🌐 Current Origin:", window.location.origin);

let currentPage = 1;
let totalPages = 1;
let currentFilters = {};

function getHeaders() {
  return {
    "Content-Type": "application/json"
  };
}

async function adminLogin() {
  // Redirect to the professional login page instead of using prompt()
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadOrders();
  loadTrends();
  loadVendorHealth();
  initSocket();
  
  if (document.getElementById("refreshBtn")) {
    document.getElementById("refreshBtn").addEventListener("click", loadOrders);
  }
  if (document.getElementById("searchInput")) {
    document.getElementById("searchInput").addEventListener("input", debounce(searchOrders, 500));
  }
  if (document.getElementById("networkFilter")) {
    document.getElementById("networkFilter").addEventListener("change", filterOrders);
  }
  if (document.getElementById("statusFilter")) {
    document.getElementById("statusFilter").addEventListener("change", filterOrders);
  }

  // Safety fallback: refresh every 5 minutes instead of aggressive polling
  setInterval(() => {
    loadStats();
    loadVendorHealth();
    loadOrders();
  }, 300000);
});

function initSocket() {
  const socket = io(API_BASE.replace('/api', ''), {
    withCredentials: true
  });

  socket.on("connect", () => {
    console.log("✅ Admin Socket connected");
    socket.emit("subscribeAdmin");
  });

  socket.on("orderUpdate", (data) => {
    console.log("🔄 Order update received via Socket:", data);
    loadOrders();
    loadStats();
  });

  socket.on("paymentConfirmed", (data) => {
    console.log("💰 Payment confirmed via Socket:", data);
    loadOrders();
    loadStats();
  });

  socket.on("vendorHealth", (data) => {
    console.log("🏥 Vendor health update received via Socket");
    updateVendorHealthUI(data);
  });
}

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard/stats`, {
      headers: getHeaders(),
      credentials: "include"
    });
    
    if (!res.ok) {
      if (res.status === 401) return adminLogin();
      const errorData = await res.json().catch(() => ({}));
      console.error(`❌ Stats error: ${res.status}`, errorData);
      throw new Error(errorData.error || `Stats error: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("✅ Stats loaded:", data);

    // Map data from the structured backend response (summary and financial objects)
    const totalEl = document.getElementById("total");
    const successEl = document.getElementById("success");
    const revenueEl = document.getElementById("revenue");
    const profitEl = document.getElementById("profit");
    
    if (totalEl) totalEl.innerText = data.summary?.total || 0;
    if (successEl) successEl.innerText = data.summary?.completed || 0;
    if (revenueEl) revenueEl.innerText = Number(data.financial?.totalRevenue || 0).toFixed(2);
    if (profitEl) profitEl.innerText = Number(data.financial?.totalProfit || 0).toFixed(2);
  } catch (err) {
    console.error("❌ Stats load failed:", err);
  }
}

async function loadOrders() {
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 50,
      ...currentFilters
    });

    const res = await fetch(`${API_BASE}/admin/orders?${params}`, { 
      headers: getHeaders(),
      credentials: "include"
    });
    
    if (!res.ok) {
      if (res.status === 401) return adminLogin();
      const errorData = await res.json().catch(() => ({}));
      console.error(`❌ Orders error: ${res.status}`, errorData);
      throw new Error(`Orders error: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("✅ Orders loaded:", data.orders?.length || 0);

    renderOrders(data.orders || []);
    updatePagination(data.total, data.pages);
  } catch (err) {
    console.error("❌ Orders load failed:", err);
    const tbody = document.getElementById("tableBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">Failed to load orders: ${err.message}</td></tr>`;
    }
  }
}

async function loadTrends() {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard/trends`, { 
      headers: getHeaders(),
      credentials: "include"
    });
    
    if (!res.ok) {
      if (res.status === 401) return adminLogin();
      const errorData = await res.json().catch(() => ({}));
      console.error(`❌ Trends error: ${res.status}`, errorData);
      throw new Error(`Trends error: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("✅ Trends loaded:", data?.length || 0);

    if (Array.isArray(data)) renderChart(data);
  } catch (err) {
    console.error("❌ Trends load failed:", err);
  }
}

async function loadVendorHealth() {
  try {
    const res = await fetch(`${API_BASE}/admin/vendors/health`, { 
      headers: getHeaders(),
      credentials: "include"
    });
    
    if (!res.ok) {
      if (res.status === 401) return adminLogin();
      const errorData = await res.json().catch(() => ({}));
      console.error(`❌ Health error: ${res.status}`, errorData);
      throw new Error(`Health error: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("✅ Vendor health loaded:", data);
    updateVendorHealthUI(data);
  } catch (err) {
    console.error("❌ Health check failed:", err);
  }
}

function updateVendorHealthUI(data) {
  const getDot = (status) => status === 'up' || status === 'online' ? "<span class='green'>●</span>" : "<span class='red'>●</span>";
  
  const vendorHealthEl = document.getElementById("vendorHealth");
  if (vendorHealthEl) {
    vendorHealthEl.innerHTML = `
      MTN: ${getDot(data.MTN?.status)} ${data.MTN?.status || 'Offline'} | 
      Telecel: ${getDot(data.Telecel?.status)} ${data.Telecel?.status || 'Offline'} | 
      AirtelTigo: ${getDot(data.AirtelTigo?.status)} ${data.AirtelTigo?.status || 'Offline'}
    `;
  }
}

function getStatusClass(status) {
  const map = {
    success: 'green',
    completed: 'green',
    failed: 'red',
    pending: 'orange',
    processing: 'blue',
    retrying: 'yellow'
  };
  return map[status?.toLowerCase()] || 'gray';
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderOrders(orders) {
  const tbody = document.getElementById("tableBody");
  if (!tbody) return;
  
  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center;">No orders found</td></tr>`;
    return;
  }
  
  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${escapeHTML(order.reference)}</td>
      <td>${escapeHTML(order.network)}</td>
      <td>${escapeHTML(order.bundle)}</td>
      <td>${escapeHTML(order.phone)}</td>
      <td>GHS ${Number(order.amount).toFixed(2)}</td>
      <td><span class="badge ${getStatusClass(order.paymentStatus)}">${order.paymentStatus}</span></td>
      <td><span class="badge ${getStatusClass(order.vendorStatus)}">${order.vendorStatus}</span></td>
      <td><span class="badge ${getStatusClass(order.orderStatus)}">${order.orderStatus}</span></td>
      <td>${order.retryCount || 0}</td>
      <td>${new Date(order.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join("");
}

function updatePagination(total, pages) {
  totalPages = pages || 1;
  const pageInfoEl = document.getElementById("pageInfo");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  
  if (pageInfoEl) pageInfoEl.innerText = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function filterOrders() {
  currentFilters = {
    network: document.getElementById("networkFilter")?.value || "",
    status: document.getElementById("statusFilter")?.value || ""
  };
  currentPage = 1;
  loadOrders();
}

function searchOrders() {
  const searchInput = document.getElementById("searchInput");
  currentFilters.search = searchInput?.value || "";
  currentPage = 1;
  loadOrders();
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

function renderChart(data) {
  try {
    const canvas = document.getElementById("trendsChart");
    if (!canvas) {
      console.error("Chart canvas element not found");
      return;
    }
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Chart context not available");
      return;
    }
    
    if (!Array.isArray(data)) {
      console.error("renderChart expected array, got:", typeof data);
      return;
    }

    const labels = data.map(d => d.label);
    const revenue = data.map(d => parseFloat(d.revenue));
    const orders = data.map(d => d.totalOrders);

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Revenue (GHS)", data: revenue, borderColor: "#2563eb", tension: 0.3, yAxisID: 'y' },
          { label: "Total Orders", data: orders, borderColor: "#10b981", tension: 0.3, yAxisID: 'y1' }
        ]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false,
        scales: {
          y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'GHS' } },
          y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Count' } }
        }
      }
    });
  } catch (err) {
    console.error("Chart rendering error:", err);
  }
}