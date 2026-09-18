/**
 * TVU Books & Materials - Wishlist Controller
 * Manages user personal saved books stored at users/{uid}/wishlist/{bookId}
 */

let wishlistItems = [];
let selectedBookForOrder = null;

document.addEventListener('DOMContentLoaded', () => {
  initWishlistPage();
});

window.addEventListener('authStateChanged', (e) => {
  if (e.detail.user) {
    loadWishlist(e.detail.user.uid);
  } else {
    showLoggedOutState();
  }
});

async function initWishlistPage() {
  setupOrderForm();
}

function showLoggedOutState() {
  const container = document.getElementById('wishlist-grid');
  if (container) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔒</div>
        <h3 class="empty-state-title">Sign in to View Your Wishlist</h3>
        <p class="empty-state-text">Your personal saved books are synchronized across devices with your Google account.</p>
        <button onclick="loginWithGoogle()" class="btn btn-primary">Continue with Google</button>
      </div>
    `;
  }
}

async function loadWishlist(uid) {
  const container = document.getElementById('wishlist-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="spinner" style="border-color: var(--primary); border-top-color: transparent; width: 36px; height: 36px; margin-bottom: 1rem;"></div>
      <p style="font-weight:600; color:var(--text-muted);">Loading your saved books...</p>
    </div>
  `;

  try {
    const snapshot = await db.collection('users').doc(uid).collection('wishlist').get();
    wishlistItems = [];
    snapshot.forEach(doc => {
      wishlistItems.push({ id: doc.id, ...doc.data() });
    });

    renderWishlist();
  } catch (error) {
    console.error("Wishlist fetch error:", error);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Unable to Load Wishlist</h3>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

function renderWishlist() {
  const container = document.getElementById('wishlist-grid');
  const countEl = document.getElementById('wishlist-count');

  if (countEl) {
    countEl.textContent = `${wishlistItems.length} item${wishlistItems.length === 1 ? '' : 's'} saved`;
  }

  if (!container) return;

  if (wishlistItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">💖</div>
        <h3 class="empty-state-title">Your wishlist is empty</h3>
        <p class="empty-state-text">Browse available university books and tap the heart icon to save items for later.</p>
        <a href="books.html" class="btn btn-primary">Browse Academic Books</a>
      </div>
    `;
    return;
  }

  container.innerHTML = wishlistItems.map(item => {
    const orig = Number(item.originalPrice) || 0;
    const disc = Number(item.discountedPrice) || orig;

    return `
      <div class="book-card">
        <div class="book-card-image-wrap">
          <button class="wishlist-btn-card active" 
                  onclick="removeFromWishlist('${item.id}', event)" 
                  title="Remove from Wishlist">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>

          <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&auto=format&fit=crop&q=80'}" 
               alt="${escapeHTML(item.title)}" 
               class="book-card-img" 
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&auto=format&fit=crop&q=80'">
        </div>

        <div class="book-card-body">
          <h3 class="book-card-title">${escapeHTML(item.title)}</h3>
          <p class="book-card-author">By ${escapeHTML(item.author || 'Academic Faculty')}</p>
          
          <div class="book-card-seller">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Seller: ${escapeHTML(item.sellerName || 'TVU Seller')}</span>
          </div>

          <div class="book-card-pricing">
            <span class="price-discounted">${formatINR(disc)}</span>
            ${orig > disc ? `<span class="price-original">${formatINR(orig)}</span>` : ''}
          </div>

          <div class="book-card-actions">
            <a href="book-details.html?id=${item.bookId || item.id}" class="btn btn-outline btn-sm">View Details</a>
            <button onclick="buyFromWishlist('${item.id}')" class="btn btn-primary btn-sm">
              Buy Now
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function removeFromWishlist(itemId, event) {
  if (event) event.stopPropagation();
  if (!auth.currentUser) return;

  try {
    await db.collection('users').doc(auth.currentUser.uid).collection('wishlist').doc(itemId).delete();
    wishlistItems = wishlistItems.filter(i => i.id !== itemId);
    showToast("Removed from wishlist", "info");
    renderWishlist();
  } catch (err) {
    showToast("Error removing item: " + err.message, "error");
  }
}

async function buyFromWishlist(itemId) {
  const item = wishlistItems.find(i => i.id === itemId);
  if (!item) return;

  selectedBookForOrder = {
    id: item.bookId || item.id,
    title: item.title,
    sellerName: item.sellerName,
    sellerEmail: item.sellerEmail || '',
    originalPrice: item.originalPrice,
    discountedPrice: item.discountedPrice,
    imageUrl: item.imageUrl
  };

  document.getElementById('modal-book-img').src = item.imageUrl || 'https://via.placeholder.com/90';
  document.getElementById('modal-book-title').textContent = item.title;
  document.getElementById('modal-book-seller').textContent = `Seller: ${item.sellerName || 'TVU Member'}`;
  document.getElementById('modal-book-price').textContent = formatINR(item.discountedPrice || item.originalPrice);
  document.getElementById('order-qty').value = 1;
  document.getElementById('modal-order-total').textContent = formatINR(item.discountedPrice || item.originalPrice);

  const user = auth.currentUser;
  const nameInput = document.getElementById('order-cust-name');
  if (nameInput) nameInput.value = user.displayName || '';

  openModal('buy-now-modal');
}

function setupOrderForm() {
  const form = document.getElementById('order-checkout-form');
  const qtyInput = document.getElementById('order-qty');

  if (qtyInput) {
    qtyInput.addEventListener('input', () => {
      if (!selectedBookForOrder) return;
      let qty = parseInt(qtyInput.value) || 1;
      if (qty < 1) qty = 1;
      const unitPrice = Number(selectedBookForOrder.discountedPrice) || Number(selectedBookForOrder.originalPrice) || 0;
      document.getElementById('modal-order-total').textContent = formatINR(unitPrice * qty);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedBookForOrder || !auth.currentUser) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Placing order...`;

      const user = auth.currentUser;
      const name = document.getElementById('order-cust-name').value.trim();
      const phone = document.getElementById('order-cust-phone').value.trim();
      const address = document.getElementById('order-cust-address').value.trim();
      const quantity = parseInt(qtyInput.value) || 1;

      if (!name || !phone || !address) {
        showToast("Please fill all fields.", "warning");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        return;
      }

      const unitPrice = Number(selectedBookForOrder.discountedPrice) || Number(selectedBookForOrder.originalPrice) || 0;
      const totalAmount = unitPrice * quantity;

      const orderPayload = {
        orderId: 'TVU-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase(),
        customerId: user.uid,
        userId: user.uid,
        customerName: name,
        customerEmail: user.email || '',
        customerPhone: phone,
        customerAddress: address,
        sellerId: selectedBookForOrder.sellerId || '',
        sellerName: selectedBookForOrder.sellerName || 'TVU Seller',
        sellerEmail: selectedBookForOrder.sellerEmail || '',
        bookId: selectedBookForOrder.id,
        bookTitle: selectedBookForOrder.title,
        bookImageUrl: selectedBookForOrder.imageUrl || '',
        quantity: quantity,
        originalPrice: Number(selectedBookForOrder.originalPrice) || 0,
        discountedPrice: unitPrice,
        unitPrice: unitPrice,
        totalAmount: totalAmount,
        paymentMethod: "Cash on Delivery",
        paymentStatus: "Cash on Delivery",
        orderStatus: "waiting_for_confirmation",
        sellerConfirmed: false,
        deliveryDate: null,
        deliveryDateRaw: null,
        deliveryStatus: "Waiting for Confirmation",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        const docRef = await db.collection('orders').add(orderPayload);
        orderPayload.id = docRef.id;

        closeModal('buy-now-modal');
        form.reset();

        document.getElementById('confirmed-order-id').textContent = `#${orderPayload.orderId}`;
        openModal('order-confirmed-modal');
        triggerConfettiCelebration();
        showToast("Order placed successfully!", "success");

        if (typeof sendNewOrderSellerEmail === 'function') {
          sendNewOrderSellerEmail(orderPayload);
        } else if (typeof sendSellerOrderNotification === 'function') {
          sendSellerOrderNotification(orderPayload);
        }
      } catch (err) {
        showToast("Failed to place order: " + err.message, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    });
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.removeFromWishlist = removeFromWishlist;
window.buyFromWishlist = buyFromWishlist;
