const API_BASE = "https://data-bundle-backend.onrender.com";

// Generic request handler (centralized, safe)
async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    // Handle non-JSON responses (VERY IMPORTANT)
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }

    return data;

  } catch (err) {
    console.error("API Error:", err.message);
    throw err;
  }
}


// ==========================
// PAYMENT INIT
// ==========================
export async function createPayment(payload) {
  return request(`${API_BASE}/api/payments/create`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}


// ==========================
// ORDER STATUS
// ==========================
export async function getOrder(reference) {
  return request(`${API_BASE}/api/orders/${reference}`);
}


// ==========================
// TRACK ORDER
// ==========================
export async function trackOrder(query) {
  return request(`${API_BASE}/track-order`, {
    method: "POST",
    body: JSON.stringify({ query })
  });
}


console.log("API service loaded...");