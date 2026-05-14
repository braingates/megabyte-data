import { isNetworkPhone, normalizePhone, OrderService, PaymentService, parseMoney, formatMoney } from "./api.js";

const TRANSACTION_FEE_RATE = 0.02;

let selectedBundle = null;

function qs(selector) {
  return document.querySelector(selector);
}

function setModalVisible(modal, visible) {
  if (!modal) return;
  modal.style.display = visible ? "flex" : "none";
  modal.classList.toggle("hidden", !visible);
}

function calculateFee(price) {
  return Number((price * TRANSACTION_FEE_RATE).toFixed(2));
}

function readBundleFromCard(card) {
  const network = card.querySelector("h2")?.textContent.trim() || "";
  const bundle = card.querySelector(".package")?.textContent.trim() || "";
  const priceText = card.querySelector(".price")?.textContent.trim() || "";
  const price = parseMoney(priceText);
  const fee = calculateFee(price);

  return {
    network,
    bundle,
    price,
    fee,
    total: Number((price + fee).toFixed(2)),
  };
}

function fillCheckoutModal() {
  qs("#checkoutNetwork").textContent = selectedBundle.network;
  qs("#checkoutBundle").textContent = selectedBundle.bundle;
  qs("#checkoutPrice").textContent = formatMoney(selectedBundle.price);
  qs("#checkoutFee").textContent = formatMoney(selectedBundle.fee);
  qs("#checkoutTotal").textContent = formatMoney(selectedBundle.total);
}

function fillSummaryModal(phone) {
  qs("#sumNetwork").textContent = selectedBundle.network;
  qs("#sumBundle").textContent = selectedBundle.bundle;
  qs("#sumPhone").textContent = normalizePhone(phone);
  qs("#sumPrice").textContent = formatMoney(selectedBundle.price);
  qs("#sumFee").textContent = formatMoney(selectedBundle.fee);
  qs("#sumTotal").textContent = formatMoney(selectedBundle.total);
}

function setPhoneError(message = "") {
  const error = qs("#phoneNetworkError");
  if (!error) return;
  error.textContent = message;
}

function validatePhone() {
  const phoneInput = qs("#phoneNumber");
  const phone = phoneInput?.value || "";

  if (!selectedBundle || isNetworkPhone(selectedBundle.network, phone)) {
    setPhoneError("");
    phoneInput?.removeAttribute("aria-invalid");
    return true;
  }

  setPhoneError("This number does not match the selected network bundle.");
  phoneInput?.setAttribute("aria-invalid", "true");
  return false;
}

function openCheckout(card) {
  selectedBundle = readBundleFromCard(card);
  fillCheckoutModal();
  qs("#phoneNumber").value = "";
  qs("#customerName").value = "";
  qs("#customerEmail").value = "";
  setPhoneError("");
  setModalVisible(qs("#checkoutModal"), true);
  qs("#phoneNumber")?.focus();
}

function proceedToSummary() {
  const phoneInput = qs("#phoneNumber");
  if (!selectedBundle || !validatePhone()) return;

  fillSummaryModal(phoneInput.value);
  setModalVisible(qs("#checkoutModal"), false);
  setModalVisible(qs("#summaryModal"), true);
}

async function createOrderAndPay() {
  if (!selectedBundle || !validatePhone()) {
    setModalVisible(qs("#summaryModal"), false);
    setModalVisible(qs("#checkoutModal"), true);
    return;
  }

  const button = qs("#finalConfirm");
  button.disabled = true;
  button.textContent = "Processing payment...";

  try {
    const order = {
      network: selectedBundle.network,
      bundle: selectedBundle.bundle,
      recipientNumber: qs("#phoneNumber").value,
      customerName: qs("#customerName").value.trim(),
      customerEmail: qs("#customerEmail").value.trim(),
      price: selectedBundle.price,
      transactionFee: selectedBundle.fee,
      totalAmount: selectedBundle.total,
    };

    localStorage.setItem("megabyteStationCustomerLookup", order.recipientNumber);
    
    // Directly initiate payment (which creates the order in backend)
    await PaymentService.initializePaystack(order);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Proceed to Payment";
    const errorMsg = error instanceof Error ? error.message : "Unable to process payment";
    alert(errorMsg);
    console.error("Payment error:", error);
  }
}

function bindCheckoutFlow() {
  document.querySelectorAll(".buy-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.currentTarget.closest(".bundle");
      if (card) openCheckout(card);
    });
  });

  qs("#confirmPurchase")?.addEventListener("click", proceedToSummary);
  qs("#phoneNumber")?.addEventListener("input", validatePhone);

  qs("#finalConfirm")?.addEventListener("click", createOrderAndPay);

  qs("#editBtn")?.addEventListener("click", () => {
    setModalVisible(qs("#summaryModal"), false);
    setModalVisible(qs("#checkoutModal"), true);
  });

  qs("#closeModal")?.addEventListener("click", () => setModalVisible(qs("#checkoutModal"), false));
  qs("#closeSummary")?.addEventListener("click", () => setModalVisible(qs("#summaryModal"), false));
}

document.addEventListener("DOMContentLoaded", bindCheckoutFlow);
