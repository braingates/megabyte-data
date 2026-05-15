const STORAGE_KEY = "megabyteStationOrders";
const FLASH_KEY = "megabyteStationFlash";
const ADMIN_REFRESH_MS = 15000;
const PENDING_PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;
const API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? `http://${window.location.hostname}:5001` 
  : "https://data-bundle-backend.onrender.com";

// Updated network prefixes for Ghana (correct formats)
const NETWORK_PREFIXES = {
  MTN: ["024", "054", "055", "025", "059", "053"],
  Telecel: ["020", "050"],
  AirtelTigo: ["026", "056", "027", "057"],
};

const VENDOR_NAMES = {
  MTN: "mtnVendorService",
  Telecel: "telecelVendorService",
  AirtelTigo: "airteltigoVendorService",
};

const currencyFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
});

function readOrders() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent("orders:updated", { detail: orders }));
}

function updateOrder(reference, updater) {
  const orders = readOrders();
  const nextOrders = orders.map((order) => {
    if (order.reference !== reference) return order;
    return { ...order, ...updater(order), updatedAt: new Date().toISOString() };
  });
  writeOrders(nextOrders);
  return nextOrders.find((order) => order.reference === reference);
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.startsWith("233") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  if (digits.length === 9) {
    return `0${digits}`;
  }

  return digits;
}

function isNetworkPhone(network, phone) {
  const normalized = normalizePhone(phone);
  return normalized.length === 10 && (NETWORK_PREFIXES[network] || []).some((prefix) => normalized.startsWith(prefix));
}

function parseMoney(value) {
  const amount = String(value || "").replace(/[^\d.]/g, "");
  return Number.parseFloat(amount) || 0;
}

function formatMoney(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function setFlash(message, type = "success") {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
}

function getFlash() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  sessionStorage.removeItem(FLASH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const OrderService = {
  async fetchOrders(phone = null) {
    try {
      let url;
      let headers = {};
      
      // If phone provided, fetch customer-specific orders via the public orders endpoint
      if (phone) {
        url = `${API_BASE_URL}/api/orders?search=${encodeURIComponent(phone)}`;
        // No API key needed for customer orders
      } else {
        // Default to the public orders root instead of a protected admin endpoint
        // This prevents unauthorized redirects to login for customer views
        url = `${API_BASE_URL}/api/orders`;
      }
      
      const response = await fetch(url, { headers, credentials: "include" }); // Ensure credentials are included for admin

      if (!response.ok) {
        throw new Error(`Failed to fetch orders (${response.status})`);
      }
      
      const data = await response.json();
      
      // Handle both array response and paginated response
      const orders = Array.isArray(data) ? data : (data.orders || []);
      
      writeOrders(orders); // Update local storage for immediate UI
      return orders;
    } catch (err) {
      console.warn("Backend sync failed. Using local cache:", err.message);
      return readOrders();
    }
  },

  async createOrder(payload) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/orders`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": localStorage.getItem("megabyteAdminKey") || ""
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to create order");
      }
      const order = await response.json();
      // Still keep a local copy for immediate UI responsiveness
      writeOrders([order, ...readOrders()]);
      return order;
    } catch (err) {
      console.error("Order creation failed:", err);
      throw err;
    }
  },

  getOrders() {
    return readOrders(); // Return local orders for quick UI, actual sync is backend driven
  },

  findByReference(reference) {
    return readOrders().find((order) => order.reference === reference || order.transactionReference === reference || order.trackingId === reference);
  },

  search(query) {
    const term = String(query || "").trim().toLowerCase();
    if (!term) return [];

    return this.getOrders().filter((order) => {
      // Use strict matching for customer tracking to prevent privacy leaks
      const keys = [
        "reference",
        "shortTrackingId",
        "trackingId",
        "vendorReference",
        "phone",
        "recipientNumber"
      ];
      return keys.some((key) => String(order[key] || "").toLowerCase() === term);
    });
  },
};

const PaymentService = {
  async initializePaystack(order) {
    // Create payment via backend which initiates Paystack payment
    const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: order.recipientNumber,
        network: order.network,
        amount: order.totalAmount,
        bundle: order.bundle,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.authorization_url) {
      throw new Error(data.error || "Unable to initialize Paystack payment");
    }

    return data.authorization_url;
  },

  async handleCallbackFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    const status = params.get("payment_status");

    if (!reference) return null;

    let verifiedStatus = status;

    if (!verifiedStatus) {
      const response = await fetch(`${API_BASE_URL}/api/payments/verify/${encodeURIComponent(reference)}`);
      const data = await response.json().catch(() => ({}));
      verifiedStatus = response.ok && data.success ? "success" : "failed";
    }

    // The actual payment confirmation and order status update will happen via Paystack webhook on the backend.
    // Here, we just set a flash message and clean the URL.
    if (verifiedStatus === "success") {
      setFlash("Payment successful. Your bundle is being processed.", "success");
      localStorage.removeItem("megabyteLastOrderRef");
    } else if (verifiedStatus === "failed") {
      setFlash("Payment failed. Please try again or contact support.", "failed");
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl);
    return { reference, status: verifiedStatus };
  },
};

window.MegabyteStation = {
  ADMIN_REFRESH_MS,
  PENDING_PAYMENT_TIMEOUT_MS,
  NETWORK_PREFIXES,
  OrderService,
  PaymentService,
  formatMoney,
  getFlash,
  isNetworkPhone,
  normalizePhone,
  parseMoney,
  setFlash,
};

export {
  ADMIN_REFRESH_MS,
  PENDING_PAYMENT_TIMEOUT_MS,
  NETWORK_PREFIXES,
  OrderService,
  PaymentService,
  formatMoney,
  getFlash,
  isNetworkPhone,
  normalizePhone,
  parseMoney,
  setFlash,
};
