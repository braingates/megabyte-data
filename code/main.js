 import { PaymentService, ADMIN_REFRESH_MS, getFlash, OrderService } from "./api.js";
import { showFlash } from "./ui.js";

document.addEventListener("DOMContentLoaded", () => {
  PaymentService.handleCallbackFromUrl().finally(() => {
    const flash = getFlash();
    if (flash) showFlash(flash.message, flash.type);
  });
});
