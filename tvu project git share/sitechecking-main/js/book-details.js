/**
 * TVU Books & Materials - Book Details Controller
 * Loads detailed book information from books/{bookId}, seller profile, and handles COD ordering & wishlist
 */

let currentBook = null;
let isCurrentBookWishlisted = false;

document.addEventListener('DOMContentLoaded', () => {
  initBookDetailsPage();
});

async function initBookDetailsPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const bookId = urlParams.get('id');

  if (!bookId) {
    showErrorState("No book specified in URL.");
    return;
  }

  setupOrderForm();
  await loadBookDetails(bookId);
}

async function loadBookDetails(bookId) {
  const container = document.getElementById('book-details-wrapper');
  if (!container) return;

  if (!window.isFirebaseConfigured()) {
    showErrorState("Please configure Firebase in js/firebase-config.js to load live book details.");
    return;
  }

  try {
    const doc = await db.collection('books').doc(bookId).get();
    if (!doc.exists) {
      showErrorState("The requested book listing could not be found or has been removed.");
      return;
    }

    currentBook = { id: doc.id, ...doc.data() };

    // Check wishlist state
    if (auth.currentUser) {
      const wishDoc = await db.collection('users').doc(auth.currentUser.uid).collection('wishlist').doc(bookId).get();
      isCurrentBookWishlisted = wishDoc.exists;
    }

    renderBookDetails();
  } catch (error) {
    console.error("Error loading book details:", error);
    showErrorState("Failed to load book: " + error.message);
  }
}

function renderBookDetails() {
  const container = document.getElementById('book-details-wrapper');
  if (!container || !currentBook) return;

  const orig = Number(currentBook.originalPrice) || 0;
  const disc = Number(currentBook.discountedPrice) || orig;
  let discountPct = 0;
  if (orig > 0 && disc < orig) {
    discountPct = Math.round(((orig - disc) / orig) * 100);
  }

  const isInStock = (currentBook.stock === undefined || Number(currentBook.stock) > 0);

  container.innerHTML = `
    <div class="book-details-layout">
      <!-- Gallery Column -->
      <div class="book-details-gallery">
        <img src="${currentBook.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80'}" 
             alt="${escapeHTML(currentBook.title)}" 
             class="book-details-img-main"
             onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80'">
      </div>

      <!-- Info Column -->
      <div class="book-details-info">
        <span class="book-details-category">${escapeHTML(currentBook.category || 'General')}</span>
        <h1 class="book-details-title heading-academic">${escapeHTML(currentBook.title)}</h1>
        <p class="book-details-author">Author / Faculty: <strong>${escapeHTML(currentBook.author || 'Academic Faculty')}</strong></p>

        <!-- Pricing Box -->
        <div class="book-details-pricing-box">
          <div>
            <div class="meta-label">Marketplace Price</div>
            <div class="details-price-wrap">
              <span class="details-price-curr">${formatINR(disc)}</span>
              ${orig > disc ? `<span class="details-price-orig">${formatINR(orig)}</span>` : ''}
              ${discountPct > 0 ? `<span class="badge badge-discount">${discountPct}% OFF</span>` : ''}
            </div>
          </div>
          <span class="badge ${isInStock ? 'badge-stock-in' : 'badge-stock-out'}" style="font-size:0.875rem; padding:0.4rem 0.8rem;">
            ${isInStock ? `In Stock (${currentBook.stock || 1} available)` : 'Out of Stock'}
          </span>
        </div>

        <!-- Meta Details Table -->
        <div class="details-meta-list">
          <div class="meta-item">
            <span class="meta-label">Seller</span>
            <span class="meta-val">${escapeHTML(currentBook.sellerName || 'TVU Seller')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Category</span>
            <span class="meta-val">${escapeHTML(currentBook.category || 'General')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Method</span>
            <span class="meta-val" style="color:var(--secondary);">Cash on Delivery (COD)</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Listed On</span>
            <span class="meta-val">${formatDate(currentBook.createdAt)}</span>
          </div>
        </div>

        <!-- Description -->
        <div class="book-details-desc">
          <h3 class="details-subtitle">Book Overview & Condition</h3>
          <p class="details-text">${escapeHTML(currentBook.description || 'No detailed description provided by the seller.')}</p>
        </div>

        ${currentBook.notes ? `
          <div class="book-details-desc" style="background-color:var(--bg-subtle); padding:1rem; border-radius:var(--radius-md); margin-bottom:1.5rem;">
            <h4 style="font-size:0.9rem; font-weight:700; color:var(--text-main); margin-bottom:0.25rem;">Seller Notes / Study Material Highlights</h4>
            <p class="details-text" style="font-size:0.875rem;">${escapeHTML(currentBook.notes)}</p>
          </div>
        ` : ''}

        <!-- Actions -->
        <div class="book-details-actions">
          <button onclick="toggleDetailsWishlist()" id="details-wish-btn" class="btn btn-outline" style="flex:1;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isCurrentBookWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" class="${isCurrentBookWishlisted ? 'text-danger' : ''}">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span>${isCurrentBookWishlisted ? 'In Wishlist' : 'Add to Wishlist'}</span>
          </button>
          
          <button onclick="initiateBuyNowFromDetails()" class="btn btn-primary" style="flex:1.5;" ${!isInStock ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <span>Buy Now (Cash on Delivery)</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function showErrorState(msg) {
  const container = document.getElementById('book-details-wrapper');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Book Not Found</h3>
        <p class="empty-state-text">${msg}</p>
        <a href="books.html" class="btn btn-primary">Browse Available Books</a>
      </div>
    `;
  }
}

async function toggleDetailsWishlist() {
  if (!auth.currentUser) {
    showToast("Please sign in with Google to add books to your wishlist.", "warning");
    return;
  }

  if (!currentBook) return;

  const uid = auth.currentUser.uid;
  const wishRef = db.collection('users').doc(uid).collection('wishlist').doc(currentBook.id);

  try {
    if (isCurrentBookWishlisted) {
      await wishRef.delete();
      isCurrentBookWishlisted = false;
      showToast("Removed from wishlist", "info");
    } else {
      await wishRef.set({
        bookId: currentBook.id,
        title: currentBook.title,
        author: currentBook.author || '',
        category: currentBook.category || 'General',
        originalPrice: Number(currentBook.originalPrice) || 0,
        discountedPrice: Number(currentBook.discountedPrice) || 0,
        imageUrl: currentBook.imageUrl || '',
        sellerName: currentBook.sellerName || '',
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      isCurrentBookWishlisted = true;
      showToast("Added to wishlist", "success");
    }
    renderBookDetails();
  } catch (err) {
    showToast("Failed to update wishlist: " + err.message, "error");
  }
}

function initiateBuyNowFromDetails() {
  if (!auth.currentUser) {
    showToast("Please sign in with Google to place an order.", "warning");
    return;
  }

  if (!currentBook) return;

  document.getElementById('modal-book-img').src = currentBook.imageUrl || 'https://via.placeholder.com/90';
  document.getElementById('modal-book-title').textContent = currentBook.title;
  document.getElementById('modal-book-seller').textContent = `Seller: ${currentBook.sellerName || 'TVU Member'}`;
  document.getElementById('modal-book-price').textContent = formatINR(currentBook.discountedPrice || currentBook.originalPrice);
  document.getElementById('order-qty').value = 1;
  document.getElementById('modal-order-total').textContent = formatINR(currentBook.discountedPrice || currentBook.originalPrice);

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
      if (!currentBook) return;
      let qty = parseInt(qtyInput.value) || 1;
      if (qty < 1) qty = 1;
      const unitPrice = Number(currentBook.discountedPrice) || Number(currentBook.originalPrice) || 0;
      document.getElementById('modal-order-total').textContent = formatINR(unitPrice * qty);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentBook || !auth.currentUser) return;

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
        showToast("Please fill all required fields.", "warning");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        return;
      }

      const unitPrice = Number(currentBook.discountedPrice) || Number(currentBook.originalPrice) || 0;
      const totalAmount = unitPrice * quantity;

      const orderPayload = {
        orderId: 'TVU-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase(),
        customerId: user.uid,
        userId: user.uid,
        customerName: name,
        customerEmail: user.email || '',
        customerPhone: phone,
        customerAddress: address,
        sellerId: currentBook.sellerId || '',
        sellerName: currentBook.sellerName || 'TVU Seller',
        sellerEmail: currentBook.sellerEmail || '',
        bookId: currentBook.id,
        bookTitle: currentBook.title,
        bookImageUrl: currentBook.imageUrl || '',
        quantity: quantity,
        originalPrice: Number(currentBook.originalPrice) || 0,
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

        if (currentBook.stock !== undefined && currentBook.stock > 0) {
          const newStock = Math.max(0, currentBook.stock - quantity);
          await db.collection('books').doc(currentBook.id).update({
            stock: newStock,
            availability: newStock > 0 ? "In Stock" : "Out of Stock"
          });
          currentBook.stock = newStock;
        }

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
        renderBookDetails();
      } catch (err) {
        console.error("Order error:", err);
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

window.toggleDetailsWishlist = toggleDetailsWishlist;
window.initiateBuyNowFromDetails = initiateBuyNowFromDetails;
