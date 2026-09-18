/**
 * TVU Books & Materials - Customer Orders Controller
 * Fetches and displays customer order history from orders collection where customerId == uid
 */

let myOrders = [];

document.addEventListener('DOMContentLoaded', () => {
  initOrdersPage();
});

window.addEventListener('authStateChanged', (e) => {
  if (e.detail.user) {
    loadCustomerOrders(e.detail.user.uid);
  } else {
    showLoggedOutState();
  }
});

async function initOrdersPage() {
  // Wait for auth observer
}

function showLoggedOutState() {
  const container = document.getElementById('orders-list-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <h3 class="empty-state-title">Sign in to View Your Orders</h3>
        <p class="empty-state-text">Track your confirmed book purchases and delivery details.</p>
        <button onclick="loginWithGoogle()" class="btn btn-primary">Continue with Google</button>
      </div>
    `;
  }
}

async function loadCustomerOrders(uid) {
  const container = document.getElementById('orders-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <div class="spinner" style="border-color: var(--primary); border-top-color: transparent; width: 36px; height: 36px; margin-bottom: 1rem;"></div>
      <p style="font-weight:600; color:var(--text-muted);">Retrieving your order records...</p>
    </div>
  `;

  try {
    const snapshot = await db.collection('orders')
      .where('customerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    myOrders = [];
    snapshot.forEach(doc => {
      myOrders.push({ id: doc.id, ...doc.data() });
    });

    renderCustomerOrders();
  } catch (error) {
    console.error("Error loading orders:", error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Unable to Load Orders</h3>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

function renderCustomerOrders() {
  const container = document.getElementById('orders-list-container');
  const countEl = document.getElementById('orders-count');

  if (countEl) {
    countEl.textContent = `${myOrders.length} order${myOrders.length === 1 ? '' : 's'} placed`;
  }

  if (!container) return;

  if (myOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛍️</div>
        <h3 class="empty-state-title">You haven't placed any orders yet.</h3>
        <p class="empty-state-text">Browse university course textbooks, study notes, and research materials on campus.</p>
        <a href="books.html" class="btn btn-primary">Browse Available Books</a>
      </div>
    `;
    return;
  }

  container.innerHTML = myOrders.map(order => {
    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <span class="order-id-badge">#${escapeHTML(order.orderId || order.id)}</span>
            <span class="order-date" style="margin-left:0.75rem;">Placed on ${formatDate(order.createdAt)}</span>
          </div>
          <span class="badge badge-stock-in" style="font-size:0.8rem;">${escapeHTML(order.orderStatus || 'Confirmed')}</span>
        </div>

        <div class="order-body-grid">
          <img src="${order.bookImageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=160&auto=format&fit=crop&q=80'}" 
               alt="${escapeHTML(order.bookTitle)}" 
               class="order-book-img"
               onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=160&auto=format&fit=crop&q=80'">

          <div class="order-details-col">
            <h4>${escapeHTML(order.bookTitle)}</h4>
            <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.35rem;">
              Seller: <strong>${escapeHTML(order.sellerName || 'TVU Seller')}</strong> (${escapeHTML(order.sellerEmail || 'Campus Seller')})
            </p>
            <p style="font-size:0.875rem; color:var(--text-muted);">
              Quantity: <strong>${order.quantity || 1}</strong> × ${formatINR(order.discountedPrice || order.originalPrice)}
            </p>
            
            <div class="order-customer-info">
              <div><strong>Delivery Address:</strong> ${escapeHTML(order.customerAddress || 'On Campus')}</div>
              <div><strong>Contact Phone:</strong> ${escapeHTML(order.customerPhone || 'N/A')}</div>
            </div>
          </div>

          <div style="text-align:right;">
            <div class="meta-label">Total Amount</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--primary);">${formatINR(order.totalAmount)}</div>
            <div style="font-size:0.8rem; color:var(--secondary); font-weight:700; margin-top:0.25rem;">
              ✓ ${escapeHTML(order.paymentMethod || 'Cash on Delivery')}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
