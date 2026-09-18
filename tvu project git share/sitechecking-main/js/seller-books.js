/**
 * TVU Books & Materials - Seller Books Management Controller
 * Handles: Adding Books with Firebase Storage Image Upload, Editing Listings, Replacing Images, and Deleting
 */

let sellerBooks = [];
let currentSeller = null;
let editingBookId = null;
let selectedFile = null;
let editSelectedFile = null;

const CATEGORIES = [
  "Computer Science",
  "Mathematics",
  "Science",
  "Commerce",
  "Management",
  "Arts",
  "General",
  "Study Materials",
  "Other"
];

document.addEventListener('DOMContentLoaded', () => {
  initSellerBooksPage();
});

window.addEventListener('authStateChanged', async (e) => {
  if (e.detail.user) {
    const seller = await fetchSellerProfile(e.detail.user.uid);
    if (!seller) {
      showToast("Please complete your seller registration first.", "warning");
      setTimeout(() => {
        window.location.href = "seller.html";
      }, 1000);
      return;
    }
    currentSeller = seller;
    loadSellerBooks(e.detail.user.uid);
  } else {
    showLoggedOutState();
  }
});

function initSellerBooksPage() {
  setupPriceCalculators();
  setupImageDropzones();
  setupAddBookForm();
  setupEditBookForm();
}

function showLoggedOutState() {
  const container = document.getElementById('seller-books-table-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3 class="empty-state-title">Sign in Required</h3>
        <p class="empty-state-text">You must be signed in as a registered TVU seller to manage book inventory.</p>
        <button onclick="loginWithGoogle()" class="btn btn-primary">Sign in with Google</button>
      </div>
    `;
  }
}

async function loadSellerBooks(uid) {
  const container = document.getElementById('seller-books-table-container');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <div class="spinner" style="border-color: var(--primary); border-top-color: transparent; width: 36px; height: 36px; margin-bottom: 1rem;"></div>
      <p style="font-weight:600; color:var(--text-muted);">Loading your listed books...</p>
    </div>
  `;

  try {
    const snapshot = await db.collection('books')
      .where('sellerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    sellerBooks = [];
    snapshot.forEach(doc => {
      sellerBooks.push({ id: doc.id, ...doc.data() });
    });

    renderSellerBooksTable();
  } catch (error) {
    console.error("Error fetching seller books:", error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Unable to Load Books</h3>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

function renderSellerBooksTable() {
  const container = document.getElementById('seller-books-table-container');
  const countEl = document.getElementById('seller-book-count');

  if (countEl) {
    countEl.textContent = `${sellerBooks.length} book${sellerBooks.length === 1 ? '' : 's'} listed`;
  }

  if (!container) return;

  if (sellerBooks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <h3 class="empty-state-title">No books listed yet</h3>
        <p class="empty-state-text">Start listing your course textbooks and study notes to help other students on campus.</p>
        <button onclick="openModal('add-book-modal')" class="btn btn-primary">Add Your First Book</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Book</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Availability</th>
            <th>Listed Date</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${sellerBooks.map(book => {
            const orig = Number(book.originalPrice) || 0;
            const disc = Number(book.discountedPrice) || orig;
            const isInStock = (book.stock === undefined || Number(book.stock) > 0);

            return `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:0.75rem;">
                    <img src="${book.imageUrl || 'https://via.placeholder.com/48'}" 
                         alt="${escapeHTML(book.title)}" 
                         style="width:44px; height:54px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--border-light);"
                         onerror="this.src='https://via.placeholder.com/48'">
                    <div>
                      <div style="font-weight:700; color:var(--text-main); max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHTML(book.title)}
                      </div>
                      <div style="font-size:0.8rem; color:var(--text-muted);">By ${escapeHTML(book.author || 'Faculty')}</div>
                    </div>
                  </div>
                </td>
                <td><span class="badge badge-category" style="font-size:0.75rem;">${escapeHTML(book.category || 'General')}</span></td>
                <td>
                  <div style="font-weight:700; color:var(--primary);">${formatINR(disc)}</div>
                  ${orig > disc ? `<div style="font-size:0.75rem; color:var(--text-light); text-decoration:line-through;">${formatINR(orig)}</div>` : ''}
                </td>
                <td><strong>${book.stock || 1}</strong></td>
                <td>
                  <span class="badge ${isInStock ? 'badge-stock-in' : 'badge-stock-out'}">
                    ${isInStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td style="font-size:0.825rem; color:var(--text-muted);">${formatDate(book.createdAt)}</td>
                <td style="text-align: right;">
                  <div style="display:inline-flex; gap:0.4rem;">
                    <button onclick="openEditModal('${book.id}')" class="btn btn-outline btn-sm" title="Edit book details">
                      Edit
                    </button>
                    <button onclick="deleteBookListing('${book.id}')" class="btn btn-danger btn-sm" title="Delete listing">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Setup Real-time Discount Calculator
 */
function setupPriceCalculators() {
  const origInput = document.getElementById('book-orig-price');
  const discInput = document.getElementById('book-disc-price');
  const calcBadge = document.getElementById('add-discount-preview');

  function updateDiscountBadge() {
    const orig = parseFloat(origInput.value) || 0;
    const disc = parseFloat(discInput.value) || 0;

    if (orig > 0 && disc > 0 && disc < orig) {
      const pct = Math.round(((orig - disc) / orig) * 100);
      calcBadge.textContent = `${pct}% OFF`;
      calcBadge.style.display = 'inline-block';
    } else {
      calcBadge.style.display = 'none';
    }
  }

  if (origInput && discInput) {
    origInput.addEventListener('input', updateDiscountBadge);
    discInput.addEventListener('input', updateDiscountBadge);
  }

  // For Edit modal
  const editOrig = document.getElementById('edit-book-orig-price');
  const editDisc = document.getElementById('edit-book-disc-price');
  const editBadge = document.getElementById('edit-discount-preview');

  function updateEditDiscount() {
    const orig = parseFloat(editOrig.value) || 0;
    const disc = parseFloat(editDisc.value) || 0;

    if (orig > 0 && disc > 0 && disc < orig) {
      const pct = Math.round(((orig - disc) / orig) * 100);
      editBadge.textContent = `${pct}% OFF`;
      editBadge.style.display = 'inline-block';
    } else {
      editBadge.style.display = 'none';
    }
  }

  if (editOrig && editDisc) {
    editOrig.addEventListener('input', updateEditDiscount);
    editDisc.addEventListener('input', updateEditDiscount);
  }
}

/**
 * Image Dropzones & File Validation
 */
function setupImageDropzones() {
  const dropzone = document.getElementById('add-image-dropzone');
  const fileInput = document.getElementById('add-book-image-file');
  const preview = document.getElementById('add-image-preview');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (validateImageFile(file)) {
        selectedFile = file;
        showPreview(file, preview, dropzone);
      }
    });
  }

  const editDropzone = document.getElementById('edit-image-dropzone');
  const editFileInput = document.getElementById('edit-book-image-file');
  const editPreview = document.getElementById('edit-image-preview');

  if (editDropzone && editFileInput) {
    editDropzone.addEventListener('click', () => editFileInput.click());
    editFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (validateImageFile(file)) {
        editSelectedFile = file;
        showPreview(file, editPreview, editDropzone);
      }
    });
  }
}

function validateImageFile(file) {
  if (!file) return false;
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast("Invalid file type. Please upload JPG, PNG, or WEBP.", "error");
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("File size too large. Maximum size is 5MB.", "error");
    return false;
  }
  return true;
}

function showPreview(file, imgEl, dropzoneEl) {
  const reader = new FileReader();
  reader.onload = (e) => {
    imgEl.src = e.target.result;
    imgEl.style.display = 'block';
    const textSpan = dropzoneEl.querySelector('span');
    if (textSpan) textSpan.textContent = `Selected: ${file.name}`;
  };
  reader.readAsDataURL(file);
}

/**
 * Handle Add Book Form Submit
 */
function setupAddBookForm() {
  const form = document.getElementById('add-book-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !currentSeller) return;

    if (!selectedFile) {
      showToast("Please select a book cover image.", "warning");
      return;
    }

    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    const category = document.getElementById('book-category').value;
    const description = document.getElementById('book-desc').value.trim();
    const notes = document.getElementById('book-notes').value.trim();
    const origPrice = parseFloat(document.getElementById('book-orig-price').value);
    const discPrice = parseFloat(document.getElementById('book-disc-price').value);
    const stock = parseInt(document.getElementById('book-stock').value) || 1;

    // Validations
    if (!title || !author || isNaN(origPrice) || isNaN(discPrice)) {
      showToast("Please fill in all required fields.", "warning");
      return;
    }

    if (origPrice <= 0 || discPrice <= 0) {
      showToast("Prices must be greater than 0.", "warning");
      return;
    }

    if (discPrice > origPrice) {
      showToast("Discounted price cannot be greater than original price.", "warning");
      return;
    }

    const submitBtn = document.getElementById('add-book-submit-btn');
    const progressBar = document.getElementById('add-upload-progress');
    const progressFill = document.getElementById('add-upload-fill');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Uploading image to Cloudinary...`;
    if (progressBar) progressBar.style.display = 'block';

    const uid = auth.currentUser.uid;
    const bookId = 'book_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    try {
      // 1. Upload actual image to Cloudinary using unsigned preset
      const downloadUrl = await uploadImageToCloudinary(selectedFile, (progress) => {
        if (progressFill) progressFill.style.width = `${progress}%`;
      });

      // 2. Compute discount percentage
      let discountPct = 0;
      if (origPrice > discPrice) {
        discountPct = Math.round(((origPrice - discPrice) / origPrice) * 100);
      }

      // 3. Save book payload to Firestore books/{bookId}
      const bookPayload = {
        bookId: bookId,
        title: title,
        author: author,
        category: category,
        description: description,
        notes: notes,
        sellerId: uid,
        sellerName: currentSeller.name || auth.currentUser.displayName || 'TVU Seller',
        sellerEmail: currentSeller.email || auth.currentUser.email || '',
        originalPrice: origPrice,
        discountedPrice: discPrice,
        discountPercentage: discountPct,
        imageUrl: downloadUrl,
        stock: stock,
        availability: stock > 0 ? "In Stock" : "Out of Stock",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('books').doc(bookId).set(bookPayload);

      showToast("Book uploaded successfully!", "success");
      closeModal('add-book-modal');
      form.reset();
      selectedFile = null;
      document.getElementById('add-image-preview').style.display = 'none';
      if (progressBar) progressBar.style.display = 'none';

      loadSellerBooks(uid);
    } catch (error) {
      console.error("Book creation error:", error);
      showToast("Failed to upload book: " + error.message, "error", 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Publish Book to TVU Marketplace";
      if (progressBar) progressBar.style.display = 'none';
    }
  });
}

/**
 * Open and Populate Edit Modal
 */
function openEditModal(bookId) {
  const book = sellerBooks.find(b => b.id === bookId);
  if (!book) return;

  editingBookId = bookId;
  editSelectedFile = null;

  document.getElementById('edit-book-title').value = book.title || '';
  document.getElementById('edit-book-author').value = book.author || '';
  document.getElementById('edit-book-category').value = book.category || 'General';
  document.getElementById('edit-book-desc').value = book.description || '';
  document.getElementById('edit-book-notes').value = book.notes || '';
  document.getElementById('edit-book-orig-price').value = book.originalPrice || '';
  document.getElementById('edit-book-disc-price').value = book.discountedPrice || '';
  document.getElementById('edit-book-stock').value = book.stock || 1;

  const preview = document.getElementById('edit-image-preview');
  preview.src = book.imageUrl || '';
  preview.style.display = 'block';

  const editBadge = document.getElementById('edit-discount-preview');
  const orig = Number(book.originalPrice) || 0;
  const disc = Number(book.discountedPrice) || orig;
  if (orig > 0 && disc > 0 && disc < orig) {
    const pct = Math.round(((orig - disc) / orig) * 100);
    editBadge.textContent = `${pct}% OFF`;
    editBadge.style.display = 'inline-block';
  } else {
    editBadge.style.display = 'none';
  }

  openModal('edit-book-modal');
}

/**
 * Handle Edit Book Form Submit
 */
function setupEditBookForm() {
  const form = document.getElementById('edit-book-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingBookId || !auth.currentUser) return;

    const origPrice = parseFloat(document.getElementById('edit-book-orig-price').value);
    const discPrice = parseFloat(document.getElementById('edit-book-disc-price').value);
    const stock = parseInt(document.getElementById('edit-book-stock').value) || 1;

    if (origPrice <= 0 || discPrice <= 0 || discPrice > origPrice) {
      showToast("Please enter valid prices.", "warning");
      return;
    }

    const submitBtn = document.getElementById('edit-book-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Updating book...`;

    let discountPct = 0;
    if (origPrice > discPrice) {
      discountPct = Math.round(((origPrice - discPrice) / origPrice) * 100);
    }

    const updatePayload = {
      title: document.getElementById('edit-book-title').value.trim(),
      author: document.getElementById('edit-book-author').value.trim(),
      category: document.getElementById('edit-book-category').value,
      description: document.getElementById('edit-book-desc').value.trim(),
      notes: document.getElementById('edit-book-notes').value.trim(),
      originalPrice: origPrice,
      discountedPrice: discPrice,
      discountPercentage: discountPct,
      stock: stock,
      availability: stock > 0 ? "In Stock" : "Out of Stock",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      // If user selected a replacement image, upload to Cloudinary first
      if (editSelectedFile) {
        const newUrl = await uploadImageToCloudinary(editSelectedFile);
        updatePayload.imageUrl = newUrl;
      }

      await db.collection('books').doc(editingBookId).update(updatePayload);

      showToast("Book updated successfully!", "success");
      closeModal('edit-book-modal');
      loadSellerBooks(auth.currentUser.uid);
    } catch (err) {
      console.error("Update error:", err);
      showToast("Failed to update book: " + err.message, "error", 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Save Changes";
    }
  });
}

/**
 * Delete Book Listing
 */
async function deleteBookListing(bookId) {
  if (!confirm("Are you sure you want to delete this book listing? This action cannot be undone.")) {
    return;
  }

  try {
    await db.collection('books').doc(bookId).delete();
    showToast("Book deleted successfully", "success");
    sellerBooks = sellerBooks.filter(b => b.id !== bookId);
    renderSellerBooksTable();
  } catch (error) {
    showToast("Failed to delete book: " + error.message, "error");
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.openEditModal = openEditModal;
window.deleteBookListing = deleteBookListing;
