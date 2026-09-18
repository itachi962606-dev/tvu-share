/**
 * TVU Books & Materials - Seller Registration & Profile Controller
 * Manages seller onboarding in sellers/{uid} separately from customer profile
 */

document.addEventListener('DOMContentLoaded', () => {
  initSellerPage();
});

window.addEventListener('authStateChanged', async (e) => {
  if (e.detail.user) {
    await checkSellerOnboarding(e.detail.user);
  } else {
    showLoggedOutState();
  }
});

async function initSellerPage() {
  setupSellerForm();
}

function showLoggedOutState() {
  const container = document.getElementById('seller-content-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎓</div>
        <h3 class="empty-state-title">Become a TVU Book Seller</h3>
        <p class="empty-state-text">Sign in with your Google account to list your academic textbooks and study materials for university peers.</p>
        <button onclick="loginWithGoogle()" class="btn btn-primary">Continue with Google</button>
      </div>
    `;
  }
}

async function checkSellerOnboarding(user) {
  const container = document.getElementById('seller-content-container');
  if (!container) return;

  try {
    const sellerDoc = await db.collection('sellers').doc(user.uid).get();

    if (sellerDoc.exists) {
      // User is already registered as a seller
      const seller = sellerDoc.data();
      container.innerHTML = `
        <div class="form-card" style="max-width: 640px; margin: 0 auto; text-align: center;">
          <img src="${seller.profileImage || user.photoURL || 'https://via.placeholder.com/80'}" 
               alt="${escapeHTML(seller.name)}" 
               style="width: 84px; height: 84px; border-radius: 50%; margin: 0 auto 1rem; border: 3px solid var(--accent);">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 0.25rem;">
            ${escapeHTML(seller.name)}
          </h2>
          <span class="badge badge-stock-in" style="font-size: 0.8rem; margin-bottom: 1rem;">
            ✓ Verified TVU Seller
          </span>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem;">
            ${escapeHTML(seller.department || 'Department Member')} • ${escapeHTML(seller.university || 'Thiruvalluvar University')}
          </p>

          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="seller-books.html" class="btn btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              Manage Listed Books & Add New
            </a>
            <a href="seller-orders.html" class="btn btn-outline">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
              Incoming Orders
            </a>
          </div>
        </div>
      `;
    } else {
      // Show Seller Registration Form
      renderRegistrationForm(user);
    }
  } catch (error) {
    console.error("Error checking seller profile:", error);
    showToast("Error checking seller status: " + error.message, "error");
  }
}

function renderRegistrationForm(user) {
  const container = document.getElementById('seller-content-container');
  if (!container) return;

  container.innerHTML = `
    <div class="form-card">
      <h2 class="form-title">Seller Onboarding Form</h2>
      <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:1.5rem;">
        Register as a student or faculty seller to list academic books, previous year question papers, and study guides.
      </p>

      <form id="seller-reg-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="seller-name">Full Name <span class="required">*</span></label>
            <input type="text" id="seller-name" class="form-control" value="${escapeHTML(user.displayName || '')}" required placeholder="Your full name">
          </div>
          <div class="form-group">
            <label class="form-label" for="seller-email">Email Address <span class="required">*</span></label>
            <input type="email" id="seller-email" class="form-control" value="${escapeHTML(user.email || '')}" readonly style="background-color:var(--bg-subtle);">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="seller-phone">Phone / WhatsApp Number <span class="required">*</span></label>
            <input type="tel" id="seller-phone" class="form-control" required placeholder="e.g. +91 98765 43210">
            <div class="form-help">For student buyers to contact regarding book handover.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="seller-dept">Department / Subject <span class="required">*</span></label>
            <input type="text" id="seller-dept" class="form-control" required placeholder="e.g. Computer Science, Tamil, Commerce">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="seller-university">University / Campus College</label>
          <input type="text" id="seller-university" class="form-control" value="Thiruvalluvar University, Vellore" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="seller-desc">Short Bio / About Seller</label>
          <textarea id="seller-desc" class="form-control" rows="3" placeholder="e.g. Final year MCA student selling 1st & 2nd year core textbooks in good condition."></textarea>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" id="seller-submit-btn">
          Save & Continue to Seller Dashboard
        </button>
      </form>
    </div>
  `;

  setupSellerForm();
}

function setupSellerForm() {
  const form = document.getElementById('seller-reg-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const submitBtn = document.getElementById('seller-submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Saving seller profile...`;

    const user = auth.currentUser;
    const name = document.getElementById('seller-name').value.trim();
    const phone = document.getElementById('seller-phone').value.trim();
    const dept = document.getElementById('seller-dept').value.trim();
    const university = document.getElementById('seller-university').value.trim();
    const desc = document.getElementById('seller-desc').value.trim();

    if (!name || !phone || !dept) {
      showToast("Please fill in all required fields.", "warning");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return;
    }

    const sellerPayload = {
      uid: user.uid,
      name: name,
      email: user.email || '',
      phone: phone,
      university: university || 'Thiruvalluvar University',
      department: dept,
      description: desc,
      profileImage: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      role: "seller",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('sellers').doc(user.uid).set(sellerPayload);
      showToast("Seller profile saved successfully!", "success");
      setTimeout(() => {
        window.location.href = "seller-books.html";
      }, 800);
    } catch (error) {
      console.error("Seller registration error:", error);
      showToast("Failed to save profile: " + error.message, "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
