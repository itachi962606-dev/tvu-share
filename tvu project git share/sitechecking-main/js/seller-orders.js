/**
 * TVU Books & Materials - Seller Orders Management Controller
 * Handles seller order lifecycle:
 * 1. "Confirm this Order" (requires selecting expected delivery date)
 * 2. Confirmed state displaying delivery date
 * 3. Subsequent "Mark as Delivered / Completed" action
 */

let sellerOrders = [];
let sellerOrdersUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  initSellerOrdersPage();
});

window.addEventListener('authStateChanged', async (e) => {
  if (e.detail.user) {
    const seller = await fetchSellerProfile(e.detail.user.uid);
    if (!seller) {
      showToast("Please register as a seller first to access seller orders.", "warning");
      setTimeout(() => window.location.href = 'seller.html', 1200);
      return;
    }
    loadSellerOrders(e.detail.user.uid);
  } else {
    showLoggedOutState();
  }
});

function initSellerOrdersPage() {
  setupConfirmOrderForm();
  if (typeof auth !== 'undefined' && auth.currentUser) {
    fetchSellerProfile(auth.currentUser.uid).then((seller) => {
      if (seller) {
        loadSellerOrders(auth.currentUser.uid);
      }
    });
  }
}

function showLoggedOutState() {
  if (sellerOrdersUnsubscribe) {
    sellerOrdersUnsubscribe();
    sellerOrdersUnsubscribe = null;
  }
  sellerOrders = [];

  const countEl = document.getElementById('seller-orders-count');
  if (countEl) countEl.textContent = 'Loading orders...';

  const container = document.getElementById('seller-orders-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3 class="empty-state-title">Sign in Required</h3>
        <p class="empty-state-text">Sign in with your seller account to view and manage customer purchase orders.</p>
        <button onclick="loginWithGoogle()" class="btn btn-primary" style="margin-top:1rem;">Sign in with Google</button>
      </div>
    `;
  }
}

/**
 * Realtime listener for seller's incoming orders
 */
function loadSellerOrders(uid) {
  const container = document.getElementById('seller-orders-container');
  if (!container) return;

  if (sellerOrdersUnsubscribe) {
    sellerOrdersUnsubscribe();
    sellerOrdersUnsubscribe = null;
  }

  container.innerHTML = `
    <div class="empty-state">
      <div class="spinner" style="border-color: var(--primary); border-top-color: transparent; width: 36px; height: 36px; margin-bottom: 1rem;"></div>
      <p style="font-weight:600; color:var(--text-muted);">Fetching incoming customer orders for your books...</p>
    </div>
  `;

  try {
    const ordersQuery = db.collection('orders').where('sellerId', '==', uid);

    sellerOrdersUnsubscribe = ordersQuery.onSnapshot(
      (snapshot) => {
        sellerOrders = [];
        snapshot.forEach((doc) => {
          sellerOrders.push({ id: doc.id, ...doc.data() });
        });

        // Client-side robust sorting by createdAt descending
        sellerOrders.sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));

        renderSellerOrders();
      },
      (error) => {
        console.error("Seller orders realtime listener error:", error);
        fetchSellerOrdersFallback(uid);
      }
    );
  } catch (error) {
    console.error("Error setting up seller orders listener:", error);
    fetchSellerOrdersFallback(uid);
  }
}

/**
 * Fallback fetch for seller orders
 */
async function fetchSellerOrdersFallback(uid) {
  const container = document.getElementById('seller-orders-container');
  try {
    const snapshot = await db.collection('orders').where('sellerId', '==', uid).get();
    sellerOrders = [];
    snapshot.forEach((doc) => {
      sellerOrders.push({ id: doc.id, ...doc.data() });
    });
    sellerOrders.sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
    renderSellerOrders();
  } catch (err) {
    console.error("Fallback seller orders fetch error:", err);
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Unable to Load Incoming Orders</h3>
          <p class="empty-state-text">${escapeHTML(err.message || 'Error communicating with Firestore.')}</p>
          <button onclick="loadSellerOrders('${uid}')" class="btn btn-outline" style="margin-top:1rem;">Try Again</button>
        </div>
      `;
    }
  }
}

function getOrderTimestamp(order) {
  if (order.createdAt && typeof order.createdAt.toDate === 'function') {
    return order.createdAt.toDate().getTime();
  }
  if (order.createdAt && order.createdAt.seconds) {
    return order.createdAt.seconds * 1000;
  }
  if (order.createdAt) {
    const d = new Date(order.createdAt).getTime();
    if (!isNaN(d)) return d;
  }
  return 0;
}

function renderSellerOrders() {
  const container = document.getElementById('seller-orders-container');
  const countEl = document.getElementById('seller-orders-count');

  if (countEl) {
    countEl.textContent = `${sellerOrders.length} order${sellerOrders.length === 1 ? '' : 's'} received`;
  }

  if (!container) return;

  if (sellerOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📬</div>
        <h3 class="empty-state-title">No incoming orders yet</h3>
        <p class="empty-state-text">When students purchase your listed books, their delivery details and contact numbers will appear here for confirmation.</p>
        <a href="seller-books.html" class="btn btn-primary" style="margin-top:1rem;">Manage Listed Books</a>
      </div>
    `;
    return;
  }

  container.innerHTML = sellerOrders.map((order) => {
    const status = String(order.orderStatus || '').toLowerCase();
    const isDelivered = status === 'delivered' || status === 'completed';
    // STRICT RULE: An order is ONLY confirmed if the seller has explicitly confirmed it AND set a valid delivery date.
    // Legacy documents with orderStatus: "confirmed" but sellerConfirmed: false will NEVER show as confirmed.
    const isConfirmed = !isDelivered && order.sellerConfirmed === true && Boolean(order.deliveryDate);
    const isWaiting = !isDelivered && !isConfirmed;

    let badgeHtml = '';
    let actionHtml = '';
    let statusNoticeHtml = '';

    if (isDelivered) {
      badgeHtml = `<span class="badge badge-delivered">Delivered / Completed</span>`;
      statusNoticeHtml = `
        <div class="order-status-banner delivered">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <div>
            <strong>Completed on Campus</strong>
            <div style="font-size:0.8rem; margin-top:0.1rem;">Cash collected and book handed over to student.</div>
          </div>
        </div>
      `;
      actionHtml = `<span class="badge badge-delivered" style="font-size:0.85rem; padding:0.4rem 0.8rem;">Completed</span>`;
    } else if (isConfirmed) {
      const dateText = formatDeliveryDate(order.deliveryDate);
      badgeHtml = `<span class="badge badge-confirmed">Order Confirmed</span>`;
      statusNoticeHtml = `
        <div class="order-status-banner confirmed">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <div>
            <div style="font-weight:700;">Order Confirmed</div>
            <div style="font-size:0.825rem; margin-top:0.15rem;">Delivery Date: <strong>${escapeHTML(dateText)}</strong></div>
          </div>
        </div>
      `;
      actionHtml = `
        <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
          <button onclick="openConfirmOrderModal('${order.id}')" class="btn btn-outline btn-sm" style="font-size:0.8rem;">
            Change Delivery Date
          </button>
          <button onclick="markOrderDelivered('${order.id}')" class="btn btn-primary btn-sm">
            Mark as Delivered
          </button>
        </div>
      `;
    } else {
      badgeHtml = `<span class="badge badge-waiting">Waiting for Confirmation</span>`;
      statusNoticeHtml = `
        <div class="order-status-banner waiting">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <div>
            <div style="font-weight:700;">This order is waiting for confirmation</div>
            <div style="font-size:0.825rem; margin-top:0.15rem;">Click "Confirm this Order" below to schedule the expected delivery date for the student.</div>
          </div>
        </div>
      `;
      actionHtml = `
        <button onclick="openConfirmOrderModal('${order.id}')" class="btn btn-primary" style="font-weight:700;">
          Confirm this Order
        </button>
      `;
    }

    const price = Number(order.discountedPrice || order.originalPrice || order.unitPrice || 0);
    const qty = Number(order.quantity || 1);
    const total = Number(order.totalAmount || price * qty || 0);

    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <span class="order-id-badge">#${escapeHTML(order.orderId || order.id)}</span>
            <span class="order-date" style="margin-left:0.75rem;">Received on ${formatDate(order.createdAt)}</span>
          </div>
          <div>
            ${badgeHtml}
          </div>
        </div>

        <div class="order-body-grid">
          <img src="${order.bookImageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=160&auto=format&fit=crop&q=80'}" 
               alt="${escapeHTML(order.bookTitle)}" 
               class="order-book-img"
               onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=160&auto=format&fit=crop&q=80'">

          <div class="order-details-col">
            <h4 style="font-size:1.15rem;">${escapeHTML(order.bookTitle || 'Academic Book')}</h4>
            <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.6rem;">
              Order Quantity: <strong>${qty}</strong> unit(s) • Unit Price: ${formatINR(price)}
            </p>

            <div style="background-color:var(--bg-subtle); padding:0.9rem; border-radius:var(--radius-md); border:1px solid var(--border-light);">
              <div style="font-weight:700; font-size:0.85rem; color:var(--primary); margin-bottom:0.35rem;">
                Buyer Contact & Handover Information:
              </div>
              <div style="font-size:0.85rem; color:var(--text-main); line-height:1.6;">
                <div>👤 <strong>Student Name:</strong> ${escapeHTML(order.customerName || 'TVU Student')}</div>
                <div>📞 <strong>Phone:</strong> <a href="tel:${escapeHTML(order.customerPhone)}" style="color:var(--primary); font-weight:700;">${escapeHTML(order.customerPhone || 'N/A')}</a></div>
                <div>✉️ <strong>Email:</strong> ${escapeHTML(order.customerEmail || 'N/A')}</div>
                <div>📍 <strong>Handover Location:</strong> ${escapeHTML(order.customerAddress || 'TVU Campus')}</div>
              </div>
            </div>

            ${statusNoticeHtml}
          </div>

          <div style="text-align:right;">
            <div class="meta-label">Amount to Collect (COD)</div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">${formatINR(total)}</div>
            <div style="font-size:0.8rem; color:var(--secondary); font-weight:700; margin:0.35rem 0 0.85rem;">
              💵 Collect via Cash on Delivery
            </div>

            ${actionHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Open confirmation modal to select delivery date
 */
function openConfirmOrderModal(orderId) {
  const order = sellerOrders.find((o) => o.id === orderId || o.orderId === orderId);
  if (!order) {
    showToast("Order details could not be found.", "error");
    return;
  }

  document.getElementById('confirm-order-doc-id').value = order.id;
  document.getElementById('confirm-order-summary-title').textContent = order.bookTitle || 'Academic Book';
  document.getElementById('confirm-order-summary-buyer').textContent = `Buyer: ${order.customerName || 'Student'} (${order.customerPhone || 'No Phone'})`;
  document.getElementById('confirm-order-summary-location').textContent = `Handover: ${order.customerAddress || 'TVU Campus'}`;

  const dateInput = document.getElementById('confirm-delivery-date');
  if (dateInput) {
    // Set min to today in YYYY-MM-DD
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;

    // If order already has a raw date, pre-fill it; otherwise default to today/tomorrow
    if (order.deliveryDateRaw) {
      dateInput.value = order.deliveryDateRaw;
    } else {
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tY = tomorrow.getFullYear();
      const tM = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const tD = String(tomorrow.getDate()).padStart(2, '0');
      dateInput.value = `${tY}-${tM}-${tD}`;
    }
  }

  openModal('seller-confirm-order-modal');
}

/**
 * Setup form handler for confirmation modal
 */
function setupConfirmOrderForm() {
  const form = document.getElementById('seller-confirm-order-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const docId = document.getElementById('confirm-order-doc-id').value;
    const dateVal = document.getElementById('confirm-delivery-date').value;
    const submitBtn = document.getElementById('confirm-order-submit-btn');

    if (!docId) {
      showToast("Invalid order reference.", "error");
      return;
    }

    if (!dateVal) {
      showToast("Please select a valid expected delivery date.", "warning");
      return;
    }

    // Format into standard display format e.g. "15 September 2026"
    const parts = dateVal.split('-');
    const parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(parsedDate.getTime())) {
      showToast("Please enter a valid delivery date.", "warning");
      return;
    }

    const formattedDisplayDate = parsedDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Confirming...`;

    try {
      if (!auth.currentUser) throw new Error("Authentication required.");

      await db.collection('orders').doc(docId).update({
        orderStatus: 'confirmed',
        sellerConfirmed: true,
        deliveryDate: formattedDisplayDate,
        deliveryDateRaw: dateVal,
        confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
        sellerId: auth.currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      closeModal('seller-confirm-order-modal');
      showToast(`Order confirmed! Delivery set for ${formattedDisplayDate}`, "success");

      // Update local array immediately if needed while snapshot syncs
      const match = sellerOrders.find((o) => o.id === docId);
      if (match) {
        match.orderStatus = 'confirmed';
        match.sellerConfirmed = true;
        match.deliveryDate = formattedDisplayDate;
        match.deliveryDateRaw = dateVal;
        renderSellerOrders();

        // Send confirmation email to customer with exact delivery date (Notification 3)
        if (!match.confirmationEmailSent && typeof sendOrderConfirmationCustomerEmail === 'function') {
          const emailPayload = {
            customerName: match.customerName || 'Valued Customer',
            customerEmail: match.customerEmail || '',
            sellerName: match.sellerName || (auth.currentUser ? auth.currentUser.displayName : 'TVU Seller'),
            sellerEmail: match.sellerEmail || (auth.currentUser ? auth.currentUser.email : ''),
            orderId: match.orderId || docId,
            bookTitle: match.bookTitle || 'Academic Book',
            bookImageUrl: match.bookImageUrl || '',
            quantity: match.quantity || 1,
            unitPrice: match.discountedPrice || match.unitPrice || match.price || 0,
            discountedPrice: match.discountedPrice || match.unitPrice || match.price || 0,
            totalAmount: match.totalAmount || 0,
            orderDate: match.createdAt && match.createdAt.toDate ? match.createdAt.toDate().toLocaleDateString('en-IN') : (match.orderDate || 'Recent'),
            deliveryDate: formattedDisplayDate
          };

          sendOrderConfirmationCustomerEmail(emailPayload).then((res) => {
            if (res && res.success) {
              match.confirmationEmailSent = true;
              db.collection('orders').doc(docId).update({
                confirmationEmailSent: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }).catch(console.warn);
            }
          }).catch((emailErr) => {
            console.error("Customer confirmation email dispatch notice (non-fatal):", emailErr);
          });
        }
      }

    } catch (err) {
      console.error("Order confirmation error:", err);
      showToast("Failed to confirm order: " + err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  });
}

/**
 * Mark order as delivered / completed (after confirmation)
 */
async function markOrderDelivered(orderDocId) {
  if (!confirm("Are you sure you want to mark this order as delivered and completed?")) {
    return;
  }

  try {
    await db.collection('orders').doc(orderDocId).update({
      orderStatus: 'delivered',
      deliveryStatus: 'Delivered',
      deliveredAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Order marked as delivered and completed!", "success");

    const match = sellerOrders.find((o) => o.id === orderDocId);
    if (match) {
      match.orderStatus = 'delivered';
      renderSellerOrders();
    }
  } catch (err) {
    console.error("Error marking delivered:", err);
    showToast("Failed to update status: " + err.message, "error");
  }
}

/**
 * Format delivery date gracefully
 */
function formatDeliveryDate(dateVal) {
  if (!dateVal) return 'To be announced';

  if (dateVal && typeof dateVal.toDate === 'function') {
    return dateVal.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  if (typeof dateVal === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
      const parts = dateVal.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
    return dateVal;
  }

  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } catch (e) {}

  return String(dateVal);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.openConfirmOrderModal = openConfirmOrderModal;
window.markOrderDelivered = markOrderDelivered;
window.loadSellerOrders = loadSellerOrders;
