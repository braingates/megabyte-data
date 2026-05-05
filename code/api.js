// api.js - FIX TRACKING URL
const API_BASE = "https://data-bundle-backend.onrender.com";

async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed (${res.status})`);
    }

    return data;
  } catch (err) {
    console.error("API Error:", err.message);
    throw err;
  }
}

export async function createPayment(payload) {
  return request(`${API_BASE}/api/payments/create`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getOrder(reference) {
  return request(`${API_BASE}/api/orders/${reference}`);
}

// ✅ FIXED: Proper URL path
export async function trackOrder(query) {
  return request(`${API_BASE}/api/orders/track-order`, {
    method: "POST",
    body: JSON.stringify({ query })
  });
}

console.log("API service loaded...");