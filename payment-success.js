window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("trxref");

  if (!reference) return;

  // Fallback to localhost if developing locally to prevent connection errors
  const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? `http://${window.location.hostname}:5001/api`
    : "https://data-bundle-backend.onrender.com/api";

  // Clean URL
  window.history.replaceState({}, "", window.location.pathname);

  fetch(`${API_BASE}/payments/verify/${reference}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // ✅ Store success message
        sessionStorage.setItem("orderStatus", "success");
        sessionStorage.setItem("orderMessage", "Order placed successfully ✅");
      } else {
        // ❌ Store failure message
        sessionStorage.setItem("orderStatus", "failed");
        sessionStorage.setItem("orderMessage", "Payment verification failed ❌");
      }

      // Redirect ALWAYS after verification
      window.location.href = "index.html";
    })
    .catch(err => {
      console.error("Verification error:", err);

      sessionStorage.setItem("orderStatus", "failed");
      sessionStorage.setItem("orderMessage", "Something went wrong ❌");
      
      window.location.href = "index.html";
    });
});