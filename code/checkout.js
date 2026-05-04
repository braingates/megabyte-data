import { createPayment } from "./api.js";

console.log("Checkout module loaded");

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("trackSearchInput");
  const btn = document.getElementById("trackSearchBtn");
  const resultBox = document.getElementById("trackResult");

  if (!input || !btn || !resultBox) return;

  btn.addEventListener("click", async () => {
    const query = input.value.trim();

    if (!query) {
      resultBox.innerHTML = "⚠️ Enter order ID or phone number";
      return;
    }

    resultBox.innerHTML = "⏳ Searching...";

    try {
      const res = await fetch("https://data-bundle-backend.onrender.com/api/orders/track-order", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query })
});

if (!res.ok) {
  const text = await res.text();
  throw new Error(`Server error: ${text}`);
}

const data = await res.json();
      /*
      const res = await fetch("http://localhost:5001/api/track/track-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });

      const data = await res.json();*/

      if (!res.ok) {
        resultBox.innerHTML = `❌ ${data.error}`;
        return;
      }

      resultBox.innerHTML = `
      
  <table class="track-table">
    <thead>
      <tr>
        <th>Reference</th>
        <th>Phone</th>
        <th>Network</th>
        <th>Bundle</th>
        <th>Status</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${data.reference}</td>
        <td>${data.phone}</td>
        <td>${data.network}</td>
        <td>${data.bundle}</td>
        <td class="status ${data.vendorStatus}">
          ${data.vendorStatus}
        </td>
        <td>${new Date(data.createdAt).toLocaleString()}</td>
        
      </tr>
    </tbody>
  </table>
`;
      

    } catch (err) {
      console.error(err);
      resultBox.innerHTML = "❌ Failed to track order";
    }
  });
  console.log("Tracking script initialized");
});

/*
function generateOrderId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const usePattern = Math.random() < 0.5;

  if (usePattern) {
    // ==========================
    // FORMAT: 2 NUMBERS + 2 LETTERS (e.g. 12AB)
    // ==========================
    const nums =
      Math.floor(Math.random() * 90 + 10).toString(); // 10–99

    let chars = "";
    for (let i = 0; i < 2; i++) {
      chars += letters[Math.floor(Math.random() * letters.length)];
    }

    return nums + chars;

  } else {
    // ==========================
    // FORMAT: 3 NUMBERS + 1 LETTER (e.g. 123A)
    // ==========================
    const nums =
      Math.floor(Math.random() * 900 + 100).toString(); // 100–999

    const char = letters[Math.floor(Math.random() * letters.length)];

    return nums + char;
  }
};
*/

// ==========================
// NETWORK DETECTION
// ==========================
const networkMap = {
  MTN: ["024", "025", "053", "054", "055", "059"],
  Telecel: ["020", "050"],
  AirtelTigo: ["026", "027", "056", "057"]
};

export function detectNetwork(number) {
  const clean = number.replace(/\s+/g, "").replace("+233", "0");
  const prefix = clean.substring(0, 3);

  for (const net in networkMap) {
    if (networkMap[net].includes(prefix)) return net;
  }

  return null;
}

// ==========================
// STATE
// ==========================
let isProcessing = false;

// ==========================
// DOM
// ==========================
const modal = document.getElementById("checkoutModal");
const summaryModal = document.getElementById("summaryModal");

const phoneInput = document.getElementById("phoneNumber");
const confirmBtn = document.getElementById("confirmPurchase");
const finalConfirm = document.getElementById("finalConfirm");

// ==========================
// STEP 1: SUMMARY
// ==========================
confirmBtn?.addEventListener("click", () => {
  const phone = phoneInput.value.trim();

  if (!/^(0|\+233)[2-9]\d{8}$/.test(phone)) {
    return alert("Invalid phone number");
  }

  const detected = detectNetwork(phone);
  const selected = modal.dataset.network;

  if (detected !== selected) {
    return alert(`Selected ${selected}, but number is ${detected}`);
  }

  document.getElementById("sumNetwork").innerText = selected;
  document.getElementById("sumBundle").innerText = document.getElementById("checkoutBundle").innerText;
  document.getElementById("sumPhone").innerText = phone;
  document.getElementById("sumPrice").innerText = document.getElementById("checkoutPrice").innerText;
  document.getElementById("sumFee").innerText = document.getElementById("checkoutFee").innerText;
  document.getElementById("sumTotal").innerText = document.getElementById("checkoutTotal").innerText;

  summaryModal.style.display = "flex";
  modal.style.display = "none";
});



// ==========================
// STEP 2: PAYMENT INIT
// ==========================
finalConfirm?.addEventListener("click", async (e) => {
  e.preventDefault();

  if (isProcessing) return;
  isProcessing = true;

  finalConfirm.innerText = "Redirecting...";
  finalConfirm.disabled = true;

  try {
    const phone = document.getElementById("sumPhone").innerText;
    const network = document.getElementById("sumNetwork").innerText;
    const bundle = document.getElementById("sumBundle").innerText;

    const amount = Number(
      document.getElementById("sumTotal").innerText.replace(/[^\d.]/g, "")
    );

    if (!phone || !network || !bundle || !amount) {
      throw new Error("Missing checkout data");
    }

    const data = await createPayment({
      phone,
      network,
      amount,
      bundle,
    });

    if (!data?.authorization_url) {
      throw new Error("No payment URL returned");
    }

    // UI SHORT ORDER ID (NOT DB ID)
    

    localStorage.setItem("pendingOrder", JSON.stringify({
      reference: data.reference,
      bundle: data.bundle,
      phone: data.phone,
      network: data.network,
      amount: data.amount
    }));

    console.log({ reference: data.reference });

    window.location.href = data.authorization_url;

  } catch (err) {
    console.error("Checkout error:", err);

    alert(err.message || "Payment failed");

    finalConfirm.innerText = "Proceed to Payment";
    finalConfirm.disabled = false;
    isProcessing = false;
  }
});

// ==========================
// PAYMENT RETURN + VERIFY
// ==========================




window.addEventListener("load", async () => {
  const params = new URLSearchParams(window.location.search);

  const reference = params.get("reference") || params.get("trxref");

  if (!reference) return;

  window.history.replaceState({}, "", window.location.pathname);

  try {
    const res = await fetch(
      `https://data-bundle-backend.onrender.com/api/payments/verify/${reference}`
    );

    const data = await res.json();

    if (data.success) {
      console.log("Payment confirmed ✔");
      alert("Payment successfull, order is being processed")
    } else {
      console.log("Payment failed ❌");
    }
  
  } catch (err) {
    console.error("Verify error:", err);
    alert("Payment initiation failed, please try again or contact support")
  }
}, 5000);


////////////////////////////////////////////////////

async function startOrderTracking(reference) {
  if (!reference) return;

  const interval = setInterval(async () => {
    try {
      const res = await fetch(
        `https://data-bundle-backend.onrender.com/api/orders/recent/${query}`
      );

      const data = await res.json();

      console.log("Tracking:", data);

      if (!data) return;

      if (data.vendorStatus === "success") {
        alert("✅ Bundle delivered");
        clearInterval(interval);
      }

      if (data.vendorStatus === "failed") {
        alert("❌ Delivery failed");
        clearInterval(interval);
      }

    } catch (err) {
      console.error("Tracking error:", err);
    }
  }, 5000);
};




// ==========================
// BUY BUTTONS
// ==========================
document.querySelectorAll(".buy-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const bundle = btn.closest(".bundle");

    const network = bundle.querySelector("h2").innerText;
    const pkg = bundle.querySelector(".package").innerText;
    const price = bundle.querySelector(".price").innerText;

    modal.dataset.network = network;

    document.getElementById("checkoutNetwork").innerText = network;
    document.getElementById("checkoutBundle").innerText = pkg;
    document.getElementById("checkoutPrice").innerText = price;

    const priceNum = parseFloat(price.replace(/[^\d.]/g, ""));
    const fee = priceNum * 0.02;
    const total = priceNum + fee;

    document.getElementById("checkoutFee").innerText = `GHS ${fee.toFixed(2)}`;
    document.getElementById("checkoutTotal").innerText = `GHS ${total.toFixed(2)}`;

    modal.style.display = "flex";
  });
});

// ==========================
// MODALS
// ==========================
document.getElementById("closeModal")?.addEventListener("click", () => {
  modal.style.display = "none";
});

document.getElementById("closeSummary")?.addEventListener("click", () => {
  summaryModal.style.display = "none";
});

document.getElementById("editBtn")?.addEventListener("click", () => {
  summaryModal.style.display = "none";
  modal.style.display = "flex";
});






  window.addEventListener("DOMContentLoaded", () => {
    const status = sessionStorage.getItem("orderStatus");
    const message = sessionStorage.getItem("orderMessage");

    if (!message) return;

    alert(message); // replace with toast later

    sessionStorage.removeItem("orderStatus");
    sessionStorage.removeItem("orderMessage");
  });





/*

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("trackInput");
  const btn = document.getElementById("trackBtn");

  const summaryBox = document.getElementById("orderSummary");
  const tableBody = document.getElementById("ordersTableBody");

  if (!input || !btn || !summaryBox || !tableBody) return;

  // ==========================
  // TRACK SINGLE ORDER
  // ==========================
  btn.addEventListener("click", async () => {
    const query = input.value.trim();

    if (!query) {
      alert("Enter order ID or phone number");
      return;
    }

    summaryBox.classList.remove("hidden");
    summaryBox.innerHTML = "⏳ Searching...";

    try {
      const res = await fetch(`http://localhost:5001/api/orders/track-order`);

      const data = await res.json();

      if (!res.ok) {
        summaryBox.innerHTML = `❌ ${data.error || "Order not found"}`;
        return;
      }

      // ==========================
      // SUMMARY CARD (TOP)
      // ==========================
      summaryBox.innerHTML = `
        <div class="summary-grid">
          <div><b>Reference:</b> ${data.reference}</div>
          <div><b>Phone:</b> ${data.phone}</div>
          <div><b>Network:</b> ${data.network}</div>
          <div><b>Bundle:</b> ${data.bundle}</div>
          <div><b>Amount:</b> GHS ${data.amount}</div>
          <div>
            <b>Status:</b>
            <span class="status ${data.vendorStatus}">
              ${data.vendorStatus}
            </span>
          </div>
          <div><b>Date:</b> ${new Date(data.createdAt).toLocaleString()}</div>
        </div>
      `;

      // ==========================
      // TABLE (APPEND RESULT)
      // ==========================
      tableBody.innerHTML = "";

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${data.reference}</td>
        <td>${data.phone}</td>
        <td>${data.network}</td>
        <td>${data.bundle}</td>
        <td>GHS ${data.amount}</td>
        <td class="status ${data.vendorStatus}">
          ${data.vendorStatus}
        </td>
        <td>${new Date(data.createdAt).toLocaleString()}</td>
      `;

      tableBody.appendChild(row);

    } catch (err) {
      console.error(err);
      summaryBox.innerHTML = "❌ Failed to track order";
    }
  });

  // ==========================
  // LOAD RECENT ORDERS (TAB INIT)
  // ==========================
  async function loadRecentOrders() {
    try {
      const res = await fetch(`http://localhost:5001/api/orders/track-order`);
      

      const orders = await res.json();

      if (!Array.isArray(orders)) return;

      tableBody.innerHTML = "";

      orders.reverse().forEach(order => {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td>${order.reference}</td>
          <td>${order.phone}</td>
          <td>${order.network}</td>
          <td>${order.bundle}</td>
          <td>GHS ${order.amount}</td>
          <td class="status ${order.vendorStatus}">
            ${order.vendorStatus}
          </td>
          <td>${new Date(order.createdAt).toLocaleString()}</td>
        `;

        tableBody.appendChild(row);
      });

    } catch (err) {
      console.error("Load orders error:", err);
    }
  }

  loadRecentOrders();

  console.log("Orders tab initialized");
});


/////////////////////////////////////
async function loadRecentOrders(phone) {
  try {
    if (!phone) return;

    const res = await fetch(
      `http://localhost:5001/api/orders/recent/${phone}`
    );

    if (!res.ok) throw new Error(await res.text());

    const orders = await res.json();

    renderTable(orders);

  } catch (err) {
    console.error("Load orders error:", err);
  }
};

document.getElementById("trackBtn").addEventListener("click", async () => {
  const query = document.getElementById("trackInput").value.trim();

  if (!query) return alert("Enter order ID or phone");

  try {
    const res = await fetch("http://localhost:5001/api/orders/track-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    renderSummary(data);
    renderTable([data]);

    // ✅ ALSO load full history if it's a phone
    if (/^0\d{9}$/.test(query)) {
      loadRecentOrders(query);
    }

  } catch (err) {
    console.error(err);
    alert("Order not found");
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const lastPhone = localStorage.getItem("userPhone");

  if (lastPhone) {
    loadRecentOrders(lastPhone);
  }
  
});

*/