/**
 * TVU Books & Materials - Books Catalog Controller
 * Handles: Full catalog browsing, category filtering, search, price sorting, wishlist toggle, and COD checkout
 */

let allBooks = [];
let userWishlistIds = new Set();
let selectedBookForOrder = null;

document.addEventListener('DOMContentLoaded', () => {
  initBooksPage();
});

window.addEventListener('authStateChanged', (e) => {
  if (e.detail.user) {
    loadUserWishlist(e.detail.user.uid);
  } else {
    userWishlistIds.clear();
    applyFiltersAndRender();
  }
});

async function initBooksPage() {
  setupFilterListeners();
  setupOrderForm();
  await loadBooks();
}

async function loadBooks() {
  const container = document.getElementById('books-catalog-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="spinner" style="border-color: var(--primary); border-top-color: transparent; width: 36px; height: 36px; margin-bottom: 1rem;"></div>
      <p style="font-weight:600; color:var(--text-muted);">Fetching university book listings...</p>
    </div>
  `;

  if (!window.isFirebaseConfigured()) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📚</div>
        <h3 class="empty-state-title">University Catalog</h3>
        <p class="empty-state-text">Configure Firebase in <code>js/firebase-config.js</code> to browse live books.</p>
      </div>
    `;
    return;
  }

  try {
    const snapshot = await db.collection('books').orderBy('createdAt', 'desc').get();
    allBooks = [];
    snapshot.forEach(doc => {
      allBooks.push({ id: doc.id, ...doc.data() });
    });

    if (auth.currentUser) {
      await loadUserWishlist(auth.currentUser.uid);
    } else {
      applyFiltersAndRender();
    }
  } catch (error) {
    console.error("Error loading books:", error);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Unable to Load Books</h3>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

async function loadUserWishlist(uid) {
  try {
    const snapshot = await db.collection('users').doc(uid).collection('wishlist').get();
    userWishlistIds.clear();
    snapshot.forEach(doc => userWishlistIds.add(doc.id));
  } catch (err) {
    console.warn(err);
  }
  applyFiltersAndRender();
}

function setupFilterListeners() {
  const searchInput = document.getElementById('catalog-search');
  const catSelect = document.getElementById('catalog-category');
  const sortSelect = document.getElementById('catalog-sort');
  const stockSelect = document.getElementById('catalog-stock');

  if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
  if (catSelect) catSelect.addEventListener('change', applyFiltersAndRender);
  if (sortSelect) sortSelect.addEventListener('change', applyFiltersAndRender);
  if (stockSelect) stockSelect.addEventListener('change', applyFiltersAndRender);
}

function applyFiltersAndRender() {
  const container = document.getElementById('books-catalog-grid');
  if (!container) return;

  const searchQuery = (document.getElementById('catalog-search')?.value || '').toLowerCase().trim();
  const selectedCat = document.getElementById('catalog-category')?.value || 'All';
  const selectedSort = document.getElementById('catalog-sort')?.value || 'newest';
  const selectedStock = document.getElementById('catalog-stock')?.value || 'all';

  let list = allBooks.filter(book => {
    const matchesCat = (selectedCat === 'All') || (book.category === selectedCat);
    const matchesSearch = !searchQuery || 
      (book.title && book.title.toLowerCase().includes(searchQuery)) ||
      (book.author && book.author.toLowerCase().includes(searchQuery)) ||
      (book.category && book.category.toLowerCase().includes(searchQuery));
    
    const isInStock = (book.stock === undefined || Number(book.stock) > 0);
    const matchesStock = (selectedStock === 'all') || (selectedStock === 'in-stock' && isInStock);

    return matchesCat && matchesSearch && matchesStock;
  });

  // Sorting
  if (selectedSort === 'price-low') {
    list.sort((a, b) => (a.discountedPrice || a.originalPrice) - (b.discountedPrice || b.originalPrice));
  } else if (selectedSort === 'price-high') {
    list.sort((a, b) => (b.discountedPrice || b.originalPrice) - (a.discountedPrice || a.originalPrice));
  }

  // Counter
  const countEl = document.getElementById('catalog-count');
  if (countEl) {
    countEl.textContent = `Showing ${list.length} book${list.length === 1 ? '' : 's'}`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h3 class="empty-state-title">No matching books found</h3>
        <p class="empty-state-text">Try adjusting your filters or search keywords.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(book => {
    const isWishlisted = userWishlistIds.has(book.id);
    const orig = Number(book.originalPrice) || 0;
    const disc = Number(book.discountedPrice) || orig;
    let discountPct = 0;
    if (orig > 0 && disc < orig) {
      discountPct = Math.round(((orig - disc) / orig) * 100);
    }
    const isInStock = (book.stock === undefined || Number(book.stock) > 0);

    return `
      <div class="book-card">
        <div class="book-card-image-wrap">
          <div class="card-badges">
            <span class="badge badge-category">${escapeHTML(book.category || 'General')}</span>
            ${discountPct > 0 ? `<span class="badge badge-discount">${discountPct}% OFF</span>` : ''}
            <span class="badge ${isInStock ? 'badge-stock-in' : 'badge-stock-out'}">
              ${isInStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          <button class="wishlist-btn-card ${isWishlisted ? 'active' : ''}" 
                  onclick="toggleWishlist('${book.id}', event)" 
                  title="${isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}"
                  aria-label="Wishlist">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>

          <img src="${book.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&auto=format&fit=crop&q=80'}" 
               alt="${escapeHTML(book.title)}" 
               class="book-card-img" 
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&auto=format&fit=crop&q=80'">
        </div>

        <div class="book-card-body">
          <h3 class="book-card-title" title="${escapeHTML(book.title)}">${escapeHTML(book.title)}</h3>
          <p class="book-card-author">By ${escapeHTML(book.author || 'Academic Faculty')}</p>
          
          <div class="book-card-seller">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Seller: ${escapeHTML(book.sellerName || 'TVU Seller')}</span>
          </div>

          <div class="book-card-pricing">
            <span class="price-discounted">${formatINR(disc)}</span>
            ${orig > disc ? `<span class="price-original">${formatINR(orig)}</span>` : ''}
            ${discountPct > 0 ? `<span class="discount-text">${discountPct}% off</span>` : ''}
          </div>

          <div class="book-card-actions">
            <a href="book-details.html?id=${book.id}" class="btn btn-outline btn-sm">View Details</a>
            <button onclick="initiateBuyNow('${book.id}')" class="btn btn-primary btn-sm" ${!isInStock ? 'disabled' : ''}>
              Buy Now
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleWishlist(bookId, event) {
  if (event) event.stopPropagation();

  if (!auth.currentUser) {
    showToast("Please sign in with Google to add books to your wishlist.", "warning");
    return;
  }

  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;

  const uid = auth.currentUser.uid;
  const wishRef = db.collection('users').doc(uid).collection('wishlist').doc(bookId);

  try {
    if (userWishlistIds.has(bookId)) {
      await wishRef.delete();
      userWishlistIds.delete(bookId);
      showToast("Removed from wishlist", "info");
    } else {
      await wishRef.set({
        bookId: book.id,
        title: book.title,
        author: book.author || '',
        category: book.category || 'General',
        originalPrice: Number(book.originalPrice) || 0,
        discountedPrice: Number(book.discountedPrice) || 0,
        imageUrl: book.imageUrl || '',
        sellerName: book.sellerName || '',
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      userWishlistIds.add(bookId);
      showToast("Added to wishlist", "success");
    }
    applyFiltersAndRender();
  } catch (error) {
    console.error("Wishlist error:", error);
    showToast("Could not update wishlist", "error");
  }
}

function initiateBuyNow(bookId) {
  if (!auth.currentUser) {
    showToast("Please sign in with Google to place an order.", "warning");
    return;
  }

  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;

  selectedBookForOrder = book;

  document.getElementById('modal-book-img').src = book.imageUrl || 'https://via.placeholder.com/90';
  document.getElementById('modal-book-title').textContent = book.title;
  document.getElementById('modal-book-seller').textContent = `Seller: ${book.sellerName || 'TVU Member'}`;
  document.getElementById('modal-book-price').textContent = formatINR(book.discountedPrice || book.originalPrice);
  document.getElementById('order-qty').value = 1;
  document.getElementById('modal-order-total').textContent = formatINR(book.discountedPrice || book.originalPrice);

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
        showToast("Please complete all required fields.", "warning");
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

        if (selectedBookForOrder.stock !== undefined && selectedBookForOrder.stock > 0) {
          const newStock = Math.max(0, selectedBookForOrder.stock - quantity);
          await db.collection('books').doc(selectedBookForOrder.id).update({
            stock: newStock,
            availability: newStock > 0 ? "In Stock" : "Out of Stock"
          });
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
        loadBooks();
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

window.loadBooks = loadBooks;
window.toggleWishlist = toggleWishlist;
window.initiateBuyNow = initiateBuyNow;
