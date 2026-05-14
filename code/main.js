 import { PaymentService, ADMIN_REFRESH_MS, getFlash, OrderService } from "./api.js";
import { showFlash } from "./ui.js";

document.addEventListener("DOMContentLoaded", () => {
  PaymentService.handleCallbackFromUrl().finally(() => {
    const flash = getFlash();
    if (flash) showFlash(flash.message, flash.type);
    OrderService.fetchOrders(); // Fetch latest orders after callback to update UI
  });
  window.setInterval(() => OrderService.fetchOrders(), ADMIN_REFRESH_MS); // Frontend polls backend for admin updates
});
