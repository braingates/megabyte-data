import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";
import { OrderService } from "./api.js"; // Use OrderService for fetching orders

class OrderTracker {
  constructor(phoneOrRef, renderCallback) {
    this.query = phoneOrRef;
    this.orders = [];
    this.socket = null;
    this.pollInterval = null;
    this.renderCallback = renderCallback; // Callback to update the UI
    this.API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? `http://${window.location.hostname}:5001`
      : "https://data-bundle-backend.onrender.com";
  }

  init() {
    if (this.query) {
      this.loadRecentOrders();
      this.startPolling();
      this.initSocket();
    }
  }

  initSocket() {
    this.socket = io(this.API_BASE_URL); // Connect to the backend socket server

    this.socket.on("connect", () => {
      console.log("Socket connected for order tracking");
      this.socket.emit("subscribe", this.query); 
    });

    this.socket.on("orderUpdate", (data) => {
      console.log("Socket order update received:", data);
      this.updateOrderStatus(data);
    });

    this.socket.on("paymentConfirmed", (data) => {
      console.log("Socket payment confirmed received:", data);
      this.handlePaymentConfirmed(data);
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected for order tracking");
    });
  }

  async loadRecentOrders() {
    try {
      // Use OrderService.fetchOrders which handles the API call and local storage update
      this.orders = await OrderService.fetchOrders(this.query);
      this.renderCallback(this.orders);
    } catch (err) {
      console.error("Failed to load orders for tracking:", err);
      this.renderCallback([]); // Render empty if fetch fails
    }
  }

  startPolling() {
    // Poll only for orders that are not yet completed or failed
    this.pollInterval = setInterval(async () => {
      const activeOrders = this.orders.filter(o => !["completed", "failed"].includes(o.orderStatus));
      if (activeOrders.length > 0) {
        console.log("Polling for active order updates...");
        // Re-fetch all orders to get latest status, and update UI via renderCallback
        this.orders = await OrderService.fetchOrders(this.query);
        this.renderCallback(this.orders);
      }
    }, 15000); // Poll every 15 seconds
  }

  updateOrderStatus(updatedOrder) {
    const idx = this.orders.findIndex(o => o.reference === updatedOrder.reference || o.shortTrackingId === updatedOrder.shortTrackingId);
    if (idx >= 0) {
      this.orders[idx] = { ...this.orders[idx], ...updatedOrder };
      this.renderCallback(this.orders);
    }
  }

  handlePaymentConfirmed(data) {
    // This might be redundant if loadRecentOrders is called after payment success
    // but good to have for immediate feedback
    this.loadRecentOrders();
  }

  destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.socket) this.socket.disconnect();
  }
}

export default OrderTracker;