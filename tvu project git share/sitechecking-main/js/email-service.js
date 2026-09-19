/**
 * TVU Books & Materials - EmailJS Notification Service
 */

const EMAILJS_CONFIG = {
  publicKey: "MXYcIwA64ZcSpd16U",
  serviceId: "service_4k6mfmq",
  templates: {
    welcome: "YOUR_WELCOME_TEMPLATE_ID",
    sellerNewOrder: "template_yrzbtnf",
    customerConfirmation: "template_4gypgau"
  }
};

function isEmailJSConfigured(templateKey) {
  if (!EMAILJS_CONFIG.publicKey || EMAILJS_CONFIG.publicKey.startsWith("YOUR_")) return false;
  if (!EMAILJS_CONFIG.serviceId || EMAILJS_CONFIG.serviceId.startsWith("YOUR_")) return false;
  if (templateKey && EMAILJS_CONFIG.templates) {
    const tId = EMAILJS_CONFIG.templates[templateKey];
    if (!tId || tId.startsWith("YOUR_")) return false;
  }
  return true;
}

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
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function sendWelcomeEmail(userData) {
  if (!userData || !userData.email || !isEmailJSConfigured('welcome')) return { success: false };
  try {
    await ensureEmailJSLoaded();
    const params = {
      to_email: userData.email,
      to_name: userData.name || 'Student',
      platform_name: "TVU Books & Materials",
      portal_url: window.location.origin
    };
    const res = await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.welcome, params, EMAILJS_CONFIG.publicKey);
    return { success: true, res };
  } catch (err) {
    return { success: false, err };
  }
}

async function sendNewOrderSellerEmail(orderData) {
  if (!orderData || !orderData.sellerEmail || !isEmailJSConfigured('sellerNewOrder')) return { success: false };
  try {
    await ensureEmailJSLoaded();
    const unitPrice = orderData.discountedPrice || orderData.unitPrice || 0;
    const totalAmount = orderData.totalAmount || (unitPrice * (orderData.quantity || 1));
    const params = {
      to_email: orderData.sellerEmail,
      to_name: orderData.sellerName || 'Seller',
      customer_name: orderData.customerName || 'Customer',
      customer_phone: orderData.customerPhone || 'N/A',
      delivery_address: orderData.customerAddress || 'N/A',
      book_title: orderData.bookTitle || 'Book',
      quantity: orderData.quantity || 1,
      unit_price: `₹${unitPrice}`,
      total_amount: `₹${totalAmount}`,
      order_id: orderData.orderId || orderData.id || 'N/A',
      payment_method: orderData.paymentMethod || "Cash on Delivery"
    };
    const res = await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.sellerNewOrder, params, EMAILJS_CONFIG.publicKey);
    return { success: true, res };
  } catch (err) {
    return { success: false, err };
  }
}

async function sendOrderConfirmationCustomerEmail(orderData) {
  if (!orderData || !orderData.customerEmail || !orderData.deliveryDate || !isEmailJSConfigured('customerConfirmation')) return { success: false };
  try {
    await ensureEmailJSLoaded();
    const params = {
      to_email: orderData.customerEmail,
      to_name: orderData.customerName || 'Student',
      order_id: orderData.orderId || orderData.id || 'N/A',
      book_title: orderData.bookTitle || 'Book',
      delivery_date: orderData.deliveryDate,
      seller_name: orderData.sellerName || 'TVU Seller'
    };
    const res = await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.customerConfirmation, params, EMAILJS_CONFIG.publicKey);
    return { success: true, res };
  } catch (err) {
    return { success: false, err };
  }
}

window.sendWelcomeEmail = sendWelcomeEmail;
window.sendNewOrderSellerEmail = sendNewOrderSellerEmail;
window.sendSellerOrderNotification = sendNewOrderSellerEmail;
window.sendOrderConfirmationCustomerEmail = sendOrderConfirmationCustomerEmail;