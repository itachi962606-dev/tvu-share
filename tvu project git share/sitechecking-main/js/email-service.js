/**
 * TVU Books & Materials - Centralized EmailJS Notification Service
 *
 * Handles strictly the 3 authorized automated email workflows:
 * 1. Welcome Email -> Dispatched once to new user on first Google registration
 * 2. New Order Alert -> Dispatched to Seller upon customer placing an order (No customer email at this stage)
 * 3. Order Confirmation & Delivery Date -> Dispatched to Customer only after Seller explicitly confirms with delivery date
 *
 * NOTE: Enter your live EmailJS configuration keys in the EMAILJS_CONFIG object below.
 */

const EMAILJS_CONFIG = {
  // Configured live EmailJS credentials:
  publicKey: "MXYcIwA64ZcSpd16U",
  serviceId: "service_4k6mfmq",
  templates: {
    welcome: "YOUR_WELCOME_TEMPLATE_ID",                       // Optional Welcome Email (if configured)
    sellerNewOrder: "template_yrzbtnf",                        // Template 1: Seller New Order
    customerConfirmation: "template_4gypgau"                   // Template 2: Customer Order Confirmation
  }
};

/**
 * Checks if EmailJS is configured with real non-placeholder credentials
 * @param {string} [templateKey] - 'welcome' | 'sellerNewOrder' | 'customerConfirmation'
 */
function isEmailJSConfigured(templateKey) {
  if (!EMAILJS_CONFIG.publicKey || EMAILJS_CONFIG.publicKey.startsWith("YOUR_")) return false;
  if (!EMAILJS_CONFIG.serviceId || EMAILJS_CONFIG.serviceId.startsWith("YOUR_")) return false;
  if (templateKey && EMAILJS_CONFIG.templates) {
    const tId = EMAILJS_CONFIG.templates[templateKey];
    if (!tId || tId.startsWith("YOUR_")) return false;
  }
  return true;
}

/**
 * Dynamically ensures the EmailJS browser SDK is loaded on the page
 */
async function ensureEmailJSLoaded() {
  if (typeof emailjs !== 'undefined') return true;
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="emailjs"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
    script.async = true;
    script.onload = () => {
      console.log("EmailJS SDK loaded dynamically.");
      resolve(true);
    };
    script.onerror = () => {
      console.warn("Could not load EmailJS SDK script.");
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

// =========================================================================
// 1. WELCOME EMAIL (Triggered once upon first Google Sign-In registration)
// =========================================================================
/**
 * Sends welcome email to newly registered user
 * @param {Object} userData - { name, email, uid }
 */
async function sendWelcomeEmail(userData) {
  if (!userData || !userData.email) {
    console.warn("sendWelcomeEmail: Missing user email.");
    return { success: false, reason: "INVALID_RECIPIENT" };
  }

  if (!isEmailJSConfigured('welcome')) {
    console.info("EmailJS Welcome Email template is not configured yet with live credentials.");
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  try {
    await ensureEmailJSLoaded();
    if (typeof emailjs === 'undefined') {
      console.warn("EmailJS library not available.");
      return { success: false, reason: "LIBRARY_MISSING" };
    }

    const templateParams = {
      to_email: userData.email,
      to_name: userData.name || 'Student',
      user_name: userData.name || 'Student',
      user_email: userData.email,
      platform_name: "TVU Books & Materials",
      subject: "Welcome to TVU Books & Materials",
      welcome_message: `Welcome to TVU Books & Materials, ${userData.name || 'Student'}! We are excited to have you join our academic community.`,
      description: "TVU Books & Materials is your dedicated university platform allowing Thiruvalluvar University students to browse, buy, and sell academic textbooks, department syllabus books, and study materials.",
      academic_resources_info: "You can also explore department regulation syllabuses and download verified previous year question papers directly from the portal.",
      portal_url: window.location.origin
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.welcome,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );

    console.log("Welcome email sent successfully to", userData.email, response.status, response.text);
    return { success: true, response };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return { success: false, error };
  }
}

// =========================================================================
// 2. NEW ORDER ALERT (Triggered upon customer order creation -> SELLER ONLY)
// =========================================================================
/**
 * Sends new order alert email to the seller.
 * Customer DOES NOT receive an order confirmation email at this stage.
 * @param {Object} orderData - Complete order payload from Firestore
 */
async function sendNewOrderSellerEmail(orderData) {
  if (!orderData || !orderData.sellerEmail) {
    console.warn("sendNewOrderSellerEmail: Missing seller email in order data.");
    return { success: false, reason: "INVALID_SELLER_EMAIL" };
  }

  if (!isEmailJSConfigured('sellerNewOrder')) {
    console.info("EmailJS Seller New Order template is not configured yet with live credentials. Order was saved to Firestore successfully.");
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  try {
    await ensureEmailJSLoaded();
    if (typeof emailjs === 'undefined') {
      console.warn("EmailJS library not available.");
      return { success: false, reason: "LIBRARY_MISSING" };
    }

    const unitPrice = orderData.discountedPrice || orderData.unitPrice || orderData.price || 0;
    const totalAmount = orderData.totalAmount || (unitPrice * (orderData.quantity || 1));

    const templateParams = {
      to_email: orderData.sellerEmail,
      to_name: orderData.sellerName || 'Seller',
      seller_name: orderData.sellerName || 'Seller',
      seller_email: orderData.sellerEmail,
      subject: "New Order Received - TVU Books & Materials",
      customer_name: orderData.customerName || 'Customer',
      customer_email: orderData.customerEmail || 'N/A',
      customer_phone: orderData.customerPhone || 'N/A',
      delivery_address: orderData.customerAddress || 'N/A',
      book_name: orderData.bookTitle || 'Academic Book',
      book_title: orderData.bookTitle || 'Academic Book',
      book_image: orderData.bookImageUrl || '',
      quantity: orderData.quantity || 1,
      unit_price: `₹${unitPrice}`,
      price: `₹${unitPrice}`,
      total_amount: `₹${totalAmount}`,
      order_id: orderData.orderId || orderData.id || 'N/A',
      order_date: orderData.createdAt && orderData.createdAt.toDate ? orderData.createdAt.toDate().toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
      payment_method: orderData.paymentMethod || "Cash on Delivery",
      action_message: `You have received a new book order. Customer ${orderData.customerName || 'A customer'} has ordered "${orderData.bookTitle || 'your book'}". Please review the order and confirm it from your Seller Portal.`
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.sellerNewOrder,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );

    console.log("Seller order notification email dispatched to", orderData.sellerEmail, response.status, response.text);
    return { success: true, response };
  } catch (error) {
    console.error("Failed to send seller order notification email:", error);
    return { success: false, error };
  }
}

// =========================================================================
// 3. SELLER CONFIRMATION EMAIL TO CUSTOMER (Triggered ONLY when Seller Confirms)
// =========================================================================
/**
 * Sends order confirmation email with expected delivery date to the customer.
 * MUST ONLY be triggered after sellerConfirmed === true and valid deliveryDate is set.
 * @param {Object} orderData - Order payload containing delivery date and customer details
 */
async function sendOrderConfirmationCustomerEmail(orderData) {
  if (!orderData || !orderData.customerEmail) {
    console.warn("sendOrderConfirmationCustomerEmail: Missing customer email in order data.");
    return { success: false, reason: "INVALID_CUSTOMER_EMAIL" };
  }

  if (!orderData.deliveryDate) {
    console.warn("sendOrderConfirmationCustomerEmail: Cannot send confirmation without valid delivery date.");
    return { success: false, reason: "MISSING_DELIVERY_DATE" };
  }

  if (!isEmailJSConfigured('customerConfirmation')) {
    console.info("EmailJS Customer Confirmation template is not configured yet with live credentials. Order remains confirmed in Firestore.");
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  try {
    await ensureEmailJSLoaded();
    if (typeof emailjs === 'undefined') {
      console.warn("EmailJS library not available.");
      return { success: false, reason: "LIBRARY_MISSING" };
    }

    const unitPrice = orderData.discountedPrice || orderData.unitPrice || orderData.price || 0;
    const totalAmount = orderData.totalAmount || (unitPrice * (orderData.quantity || 1));

    const templateParams = {
      to_email: orderData.customerEmail,
      to_name: orderData.customerName || 'Valued Student',
      customer_name: orderData.customerName || 'Valued Student',
      customer_email: orderData.customerEmail,
      subject: "Your Order Has Been Confirmed - TVU Books & Materials",
      order_id: orderData.orderId || orderData.id || 'N/A',
      book_name: orderData.bookTitle || 'Academic Book',
      book_title: orderData.bookTitle || 'Academic Book',
      book_image: orderData.bookImageUrl || '',
      quantity: orderData.quantity || 1,
      unit_price: `₹${unitPrice}`,
      price: `₹${unitPrice}`,
      total_amount: `₹${totalAmount}`,
      order_date: orderData.orderDate || (orderData.createdAt && orderData.createdAt.toDate ? orderData.createdAt.toDate().toLocaleDateString('en-IN') : 'Recent'),
      seller_name: orderData.sellerName || 'TVU Seller',
      delivery_date: orderData.deliveryDate,
      expected_delivery_date: orderData.deliveryDate,
      payment_method: orderData.paymentMethod || "Cash on Delivery",
      confirmation_message: `Your order has been confirmed by the seller! Your book is expected to be delivered on ${orderData.deliveryDate}.`
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.customerConfirmation,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );

    console.log("Customer order confirmation email dispatched to", orderData.customerEmail, response.status, response.text);
    return { success: true, response };
  } catch (error) {
    console.error("Failed to send customer confirmation email:", error);
    return { success: false, error };
  }
}

// Backward-compatibility aliases
const sendSellerOrderNotification = sendNewOrderSellerEmail;
const sendSellerOrderEmail = sendNewOrderSellerEmail;

// Export functions to window
window.EMAILJS_CONFIG = EMAILJS_CONFIG;
window.isEmailJSConfigured = isEmailJSConfigured;
window.sendWelcomeEmail = sendWelcomeEmail;
window.sendNewOrderSellerEmail = sendNewOrderSellerEmail;
window.sendSellerOrderNotification = sendSellerOrderNotification;
window.sendSellerOrderEmail = sendSellerOrderEmail;
window.sendOrderConfirmationCustomerEmail = sendOrderConfirmationCustomerEmail;
