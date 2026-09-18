/**
 * TVU Books & Materials - Authentication & Navigation Header Management
 * Handles: Google Sign-In, Customer Profile Sync, Header Dynamic Rendering, and Route Protection
 */

let currentAuthUser = null;
let currentCustomerData = null;
let currentSellerData = null;

// Initialize Auth Observer
function initAuth() {
  if (typeof auth === 'undefined') {
    console.error("Firebase Auth instance not found.");
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    currentAuthUser = user;
    if (user) {
      // Sync Customer Profile in Firestore
      try {
        await syncCustomerProfile(user);
        // Check if user is also registered as a seller
        await fetchSellerProfile(user.uid);
      } catch (err) {
        console.error("Profile sync error:", err);
      }
    } else {
      currentCustomerData = null;
      currentSellerData = null;
    }

    // Render navigation header based on auth state
    renderHeader();

    // Trigger custom event for other page scripts
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
  });
}

/**
 * Sync customer profile in customers/{uid}
 * Every Google user is initially a customer.
 */
async function syncCustomerProfile(user) {
  if (!db) return;
  const customerRef = db.collection('customers').doc(user.uid);
  const doc = await customerRef.get();

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const isNewUser = !doc.exists;
  const existingData = doc.exists ? doc.data() : null;

  const customerPayload = {
    uid: user.uid,
    name: user.displayName || 'University Member',
    email: user.email || '',
    profileImage: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    role: existingData && existingData.role ? existingData.role : 'customer',
    updatedAt: now
  };

  if (isNewUser) {
    customerPayload.createdAt = now;
    customerPayload.welcomeEmailSent = false;
    await customerRef.set(customerPayload);

    // Send Welcome Email ONLY on first-time user registration
    if (user.email && typeof sendWelcomeEmail === 'function') {
      sendWelcomeEmail({
        name: user.displayName || 'Student',
        email: user.email,
        uid: user.uid
      }).then((res) => {
        if (res && res.success) {
          customerRef.update({ welcomeEmailSent: true }).catch(console.warn);
        }
      }).catch((err) => {
        console.warn("Welcome email dispatch notice (non-fatal):", err);
      });
    }
  } else {
    await customerRef.update(customerPayload);
  }

  const updatedDoc = await customerRef.get();
  currentCustomerData = updatedDoc.data();
}

/**
 * Check if user has a seller profile in sellers/{uid}
 */
async function fetchSellerProfile(uid) {
  if (!db) return null;
  try {
    const sellerDoc = await db.collection('sellers').doc(uid).get();
    if (sellerDoc.exists) {
      currentSellerData = sellerDoc.data();
      return currentSellerData;
    }
    currentSellerData = null;
    return null;
  } catch (err) {
    console.error("Error fetching seller status:", err);
    return null;
  }
}

/**
 * Trigger Google Login Popup
 */
async function loginWithGoogle() {
  if (!window.isFirebaseConfigured()) {
    showToast("Please update js/firebase-config.js with your live Firebase keys.", "warning", 5000);
    return;
  }

  try {
    showToast("Connecting with Google...", "info", 2000);
    const result = await auth.signInWithPopup(googleProvider);
    showToast(`Welcome back, ${result.user.displayName || 'Student'}!`, "success");
    return result.user;
  } catch (error) {
    console.error("Google sign in failed:", error);
    if (error.code !== 'auth/popup-closed-by-user') {
      showToast(`Login failed: ${error.message}`, "error");
    }
  }
}

/**
 * Trigger Logout
 */
async function logoutUser() {
  try {
    await auth.signOut();
    showToast("Signed out successfully", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 400);
  } catch (error) {
    console.error("Logout failed:", error);
    showToast("Failed to sign out. Please try again.", "error");
  }
}

/**
 * Render Header Dynamically across all pages
 */
function renderHeader() {
  const headerContainer = document.getElementById('site-header-container');
  if (!headerContainer) return;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const user = currentAuthUser;
  const isSeller = !!currentSellerData;

  const html = `
    <header class="site-header">
      <div class="container header-inner">
        <!-- TVU Logo Area -->
        <a href="index.html" class="brand-wrapper" title="TVU Books & Materials">
          <img src="assets/tvu-logo.png" alt="Thiruvalluvar University Logo" class="brand-logo-img" onerror="this.src='https://via.placeholder.com/44?text=TVU'">
          <div class="brand-text">
            <span class="brand-name">TVU Books & Materials</span>
            <span class="brand-sub">Thiruvalluvar University</span>
          </div>
        </a>

        <!-- Main Navigation Links -->
        <nav class="main-nav" id="main-nav-menu">
          <a href="index.html" class="nav-link ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">Home</a>
          <a href="books.html" class="nav-link ${currentPath === 'books.html' ? 'active' : ''}">Books</a>
          <a href="download-syllabus.html" class="nav-link ${currentPath === 'download-syllabus.html' ? 'active' : ''}">📥 Download Syllabus</a>
          <a href="wishlist.html" class="nav-link ${currentPath === 'wishlist.html' ? 'active' : ''}">Wishlist</a>
          <a href="orders.html" class="nav-link ${currentPath === 'orders.html' ? 'active' : ''}">Orders</a>
          <a href="seller.html" class="nav-link ${currentPath === 'seller.html' || currentPath === 'seller-books.html' || currentPath === 'seller-orders.html' ? 'active' : ''}">
            Sell Your Books
          </a>
          <a href="ai-support.html" class="nav-link nav-link-ai ${currentPath === 'ai-support.html' ? 'active' : ''}">
            🤖 AI Support
          </a>
        </nav>

        <!-- Right Side User Menu / Sign In Action -->
        <div class="header-actions">
          ${user ? `
            <div class="user-menu">
              <button class="user-avatar-btn" id="user-menu-btn" aria-label="Open User Menu" onclick="toggleUserDropdown(event)">
                <img src="${user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}" alt="${user.displayName || 'User'}" class="user-avatar-img">
                <span class="user-name-label">${user.displayName ? user.displayName.split(' ')[0] : 'Account'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              
              <div class="user-dropdown" id="user-dropdown-menu">
                <div class="dropdown-header">
                  <div class="dropdown-user-name">${user.displayName || 'University Member'}</div>
                  <div class="dropdown-user-email">${user.email || ''}</div>
                </div>
                <a href="download-syllabus.html" class="dropdown-item">
                  <span style="font-size:1rem; line-height:1; margin-right:2px;">📥</span>
                  Download Syllabus & Papers
                </a>
                <a href="ai-support.html" class="dropdown-item">
                  <span style="font-size:1rem; line-height:1; margin-right:2px;">🤖</span>
                  NOVA AI Assistant
                </a>
                <a href="orders.html" class="dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                  My Orders
                </a>
                <a href="wishlist.html" class="dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  My Wishlist
                </a>
                <div class="dropdown-divider"></div>
                <a href="seller.html" class="dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  ${isSeller ? 'Seller Dashboard' : 'Become a Seller'}
                </a>
                ${isSeller ? `
                  <a href="seller-books.html" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    My Listed Books
                  </a>
                  <a href="seller-orders.html" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    Seller Orders
                  </a>
                ` : ''}
                <div class="dropdown-divider"></div>
                <button onclick="logoutUser()" class="dropdown-item text-danger" style="width:100%;border:none;background:none;text-align:left;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  Log Out
                </button>
              </div>
            </div>
          ` : `
            <button onclick="loginWithGoogle()" class="btn btn-primary btn-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          `}

          <!-- Mobile Hamburger Toggle -->
          <button class="mobile-menu-btn" id="mobile-menu-toggle" onclick="toggleMobileMenu()" aria-label="Toggle navigation">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>
  `;

  headerContainer.innerHTML = html;
  renderFloatingNovaWidget();
}

/**
 * Renders floating NOVA AI Assistant button on all pages
 */
function renderFloatingNovaWidget() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  if (currentPath === 'ai-support.html') return;

  if (!document.getElementById('nova-floating-widget')) {
    if (!document.querySelector('link[href*="ai-support.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/ai-support.css';
      document.head.appendChild(link);
    }

    const widget = document.createElement('a');
    widget.id = 'nova-floating-widget';
    widget.className = 'nova-floating-btn';
    widget.href = 'ai-support.html';
    widget.title = 'Ask NOVA AI Assistant';
    widget.innerHTML = `
      <div class="nova-floating-icon">🦢</div>
      <span class="nova-floating-label">Ask NOVA AI</span>
    `;
    document.body.appendChild(widget);
  }
}

// Dropdown toggle
function toggleUserDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

// Mobile menu toggle
function toggleMobileMenu() {
  const nav = document.getElementById('main-nav-menu');
  if (nav) {
    nav.classList.toggle('open');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown && dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
  }
});

// Guard helper for protected pages
function requireAuthentication(redirectUrl = 'index.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        showToast("Please sign in with Google to access this page.", "warning");
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1200);
      } else {
        resolve(user);
      }
    });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAuth);

// Export to window
window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
window.requireAuthentication = requireAuthentication;
window.toggleUserDropdown = toggleUserDropdown;
window.toggleMobileMenu = toggleMobileMenu;
window.fetchSellerProfile = fetchSellerProfile;
