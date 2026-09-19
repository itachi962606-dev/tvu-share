/**
 * TVU Books & Materials - Universal Dual Username / Email Engine
 * Seamlessly handles both Username and Email in Sign-up & Login
 */

let currentAuthUser = null;
let currentCustomerData = null;
let currentSellerData = null;
let globalAuthMode = 'signup';
let pendingGoogleUser = null;
let pendingSignupDetails = null;
let isCheckingSignupExisting = false;

// Initialize Auth Observer
function initAuth() {
  renderUniversalHeader();

  if (typeof auth === 'undefined') return;

  auth.onAuthStateChanged(async (user) => {
    if (isCheckingSignupExisting) return;

    const alertBox = document.getElementById('auth-existing-alert');
    if (alertBox && alertBox.style.display === 'block') {
      return;
    }

    currentAuthUser = user;

    if (user) {
      try {
        if (typeof db !== 'undefined') {
          const custDoc = await db.collection('customers').doc(user.uid).get();
          if (!custDoc.exists || !custDoc.data().username) {
            openProfileSetupModal(user);
            return;
          }
          currentCustomerData = custDoc.data();
          await syncCustomerProfile(user);
          await fetchSellerProfile(user.uid);
        }
      } catch (err) {
        console.error("Profile check error:", err);
      }
    } else {
      currentCustomerData = null;
      currentSellerData = null;
    }

    renderUniversalHeader();
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
  });
}

// Render Universal Header with Name & @username
function renderUniversalHeader() {
  const headerContainer = document.getElementById('site-header-container');
  if (!headerContainer) return;

  const user = currentAuthUser;
  const cust = currentCustomerData;
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const isHome = currentPath === 'index.html' || currentPath === '';

  const displayName = cust && cust.name ? cust.name : (user && user.displayName ? user.displayName : 'Account');
  const displayUserTag = cust && cust.username ? `@${cust.username}` : '';

  headerContainer.innerHTML = `
    <header class="custom-navbar">
      <a href="index.html" class="nav-brand" title="TVU Books & Materials">
        <img src="assets/tvu-logo.png" alt="TVU Logo" class="nav-brand-logo" onerror="this.src='https://via.placeholder.com/42?text=TVU'">
        <div class="nav-brand-text">
          <h2>TVU Books & Materials</h2>
          <small>THIRUVALLUVAR UNIVERSITY</small>
        </div>
      </a>

      <div class="nav-right">
        <!-- Standalone Home Button -->
        <a href="index.html" class="nav-home-btn ${isHome ? 'active' : ''}" title="Home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Home</span>
        </a>

        <!-- Menu Dropdown -->
        <div class="menu-dropdown" id="global-nav-dropdown">
          <button class="menu-btn" onclick="toggleGlobalMenu(event)" aria-label="Menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span>Menu ▾</span>
          </button>
          <div class="menu-content" id="global-menu-list">
            <a href="books.html" class="${currentPath === 'books.html' ? 'active-link' : ''}">📚 All Books</a>
            <a href="download-syllabus.html" class="${currentPath === 'download-syllabus.html' ? 'active-link' : ''}">📥 Download Syllabus</a>
            <a href="wishlist.html" class="${currentPath === 'wishlist.html' ? 'active-link' : ''}">❤️ My Wishlist</a>
            <a href="orders.html" class="${currentPath === 'orders.html' ? 'active-link' : ''}">📦 My Orders</a>
            <a href="seller.html" class="${currentPath === 'seller.html' || currentPath === 'seller-books.html' || currentPath === 'seller-orders.html' ? 'active-link' : ''}">💼 Sell Your Books</a>
            <a href="ai-support.html" class="${currentPath === 'ai-support.html' ? 'active-link' : ''}">🤖 AI Support</a>
            ${user ? `
              <div class="menu-divider"></div>
              <button type="button" onclick="logoutUser()" class="menu-logout-btn">
                🚪 Log Out (${escapeHTML(displayName.split(' ')[0])})
              </button>
            ` : ''}
          </div>
        </div>

        <!-- User Profile Pill or Sign Up -->
        <div id="auth-actions">
          ${user ? `
            <div class="user-pill" onclick="toggleGlobalMenu(event)" title="${escapeHTML(displayName)} (${escapeHTML(displayUserTag)})" style="display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:4px 10px; border-radius:30px; border:1px solid #cbd5e1; cursor:pointer;">
              <img src="${user.photoURL || 'https://via.placeholder.com/28'}" alt="User" class="user-pill-img" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">
              <div style="display:flex; flex-direction:column; text-align:left; line-height:1.1;">
                <span class="user-pill-name" style="font-size:0.82rem; font-weight:700; color:#0f172a;">${escapeHTML(displayName.split(' ')[0])}</span>${displayUserTag ? `<span style="font-size:0.68rem; color:#64748b; font-weight:600;">${escapeHTML(displayUserTag)}</span>` : ''}
              </div>
            </div>
          ` : `
            <button type="button" class="signup-nav-btn" onclick="openGlobalAuthModal('signup')">
              Sign up
            </button>
          `}
        </div>
      </div>
    </header>

    <!-- Modal: Username / Email Dual Flow -->
    <div class="modal-backdrop" id="global-auth-modal" style="display:none;" role="dialog" aria-modal="true">
      <div class="auth-modal-dialog">
        <div class="auth-modal-header">
          <h3 id="global-modal-title">Create an Account</h3>
          <button type="button" class="modal-close-btn" onclick="closeGlobalAuthModal()" aria-label="Close">&times;</button>
        </div>

        <!-- Alert for existing Google accounts -->
        <div id="auth-existing-alert" style="display:none; background:#fff1f2; border:1.5px solid #fecdd3; border-radius:8px; padding:1.1rem; margin-bottom:1.15rem; text-align:center;">
          <div style="font-weight:800; color:#e11d48; font-size:0.95rem; margin-bottom:0.35rem;">
            ⚠️ Already you have an account!
          </div>
          <p id="existing-user-email-text" style="font-size:0.83rem; color:#881337; margin:0 0 0.85rem; line-height:1.45;">
            Indha account ஏற்கெனவே register aagirukku. Please keezhe ulla Google Login upayogithu login seiyyavum.
          </p>
          <button type="button" class="google-btn-full" onclick="proceedExistingUserLogin()" style="background:#0f172a; color:#ffffff; border-color:#0f172a;">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17c1.8 3.7 5.6 6.5 10.1 6.5z"/>
            </svg>
            Continue with Google (Login)
          </button>
        </div>

        <div id="default-google-block">
          <button type="button" id="google-login-btn" class="google-btn-full" onclick="handleGoogleAuthTrigger()">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17c1.8 3.7 5.6 6.5 10.1 6.5z"/>
            </svg>
            <span id="google-btn-label">Continue with Google</span>
          </button>

          <div class="auth-divider">
            <span id="auth-divider-text">or Username / Email</span>
          </div>

          <form id="global-custom-form" onsubmit="handleGlobalFormSubmit(event)">
            <div class="auth-form-group">
              <label for="auth-identifier-val" id="auth-identifier-label">Username / Email</label>
              <input type="text" id="auth-identifier-val" required placeholder="Enter your username or email" oninput="handleFormIdentifierCheck(this)">
              
              <!-- Checklist displayed only when typing a username in sign-up mode -->
              <div id="signup-username-checklist" class="instruction-pop-box" style="display:none; margin-top:6px;">
                <span style="font-weight:700; display:block; margin-bottom:0.35rem; color:#0f172a;">Username Requirements:</span>
                <div class="rule-item" id="rule-letters-signup">
                  <span class="rule-indicator">✕</span> Letters (a-z, A-Z)
                </div>
                <div class="rule-item" id="rule-numbers-signup">
                  <span class="rule-indicator">✕</span> Numbers (0-9)
                </div>
                <div class="rule-item" id="rule-symbols-signup">
                  <span class="rule-indicator">✕</span> Special Character (@, #, $, _, etc.)
                </div>
                <div class="rule-item" id="rule-spaces-signup">
                  <span class="rule-indicator">✕</span> No Spaces
                </div>
              </div>
            </div>

            <div class="auth-form-group">
              <label for="auth-password-val">Password</label>
              <input type="password" id="auth-password-val" required minlength="6" placeholder="Enter password (min 6 characters)">
            </div>

            <button type="submit" id="auth-form-submit-btn" class="auth-submit-btn">
              Continue
            </button>
          </form>

          <div class="auth-switch-wrap">
            <span id="auth-switch-label">Already have an account? </span>
            <a href="javascript:void(0)" id="auth-switch-btn" onclick="toggleGlobalAuthMode()">Login</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Complete Profile Modal (Step 2) -->
    <div class="modal-backdrop" id="google-profile-setup-modal" style="display:none;" role="dialog" aria-modal="true">
      <div class="auth-modal-dialog">
        <div class="auth-modal-header">
          <h3>Complete Your Profile</h3>
          <button type="button" class="modal-close-btn" onclick="closeProfileSetupModal()" aria-label="Close">&times;</button>
        </div>
        <p style="font-size:0.85rem; color:#64748b; margin-bottom:1.2rem;">
          Mee details enter chesi registration finish cheyandi.
        </p>

        <form id="profile-details-form" onsubmit="handleProfileCompletion(event)">
          <!-- Full Name Field (Letters Only) -->
          <div class="auth-form-group">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label for="setup-full-name">Full Name <span style="color:#dc2626;">*</span></label>
              <span id="name-status-icon" style="font-size:0.8rem; font-weight:700;"></span>
            </div>
            <input type="text" id="setup-full-name" required placeholder="e.g. Ramesh Kumar" oninput="handleLiveNameCheck(this)">
          </div>

          <!-- Username Field (With live checklist) -->
          <div class="auth-form-group" style="position:relative; margin-top:1.1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label for="setup-username">Username <span style="color:#dc2626;">*</span></label>
              <span id="user-status-icon" style="font-size:0.8rem; font-weight:700;"></span>
            </div>
            <input type="text" id="setup-username" required placeholder="e.g. ramesh_99@" 
                   onfocus="showUsernameInstructions()" 
                   oninput="handleLiveUsernameCheck(this)">
            
            <div id="username-instruction-box" class="instruction-pop-box">
              <span style="font-weight:700; display:block; margin-bottom:0.35rem; color:#0f172a;">Username Requirements:</span>
              <div class="rule-item" id="rule-letters">
                <span class="rule-indicator">✕</span> Letters (a-z, A-Z)
              </div>
              <div class="rule-item" id="rule-numbers">
                <span class="rule-indicator">✕</span> Numbers (0-9)
              </div>
              <div class="rule-item" id="rule-symbols">
                <span class="rule-indicator">✕</span> Special Character (@, #, $, _, etc.)
              </div>
              <div class="rule-item" id="rule-spaces">
                <span class="rule-indicator">✕</span> No Spaces
              </div>
            </div>
          </div>

          <!-- Email Address Field -->
          <div class="auth-form-group" style="margin-top:1.1rem;">
            <label for="setup-email-address">Email Address (Security Verification) <span style="color:#dc2626;">*</span></label>
            <input type="email" id="setup-email-address" required placeholder="student@tvu.edu.in">
          </div>

          <button type="submit" id="setup-profile-submit-btn" class="auth-submit-btn" style="margin-top:1rem;">
            Save & Continue
          </button>
        </form>
      </div>
    </div>
  `;

  renderFloatingNovaWidget();
}

// Full Name Validation (Border updates, letters only)
function handleLiveNameCheck(input) {
  const icon = document.getElementById('name-status-icon');
  const val = input.value.trim();

  if (val.length === 0) {
    input.classList.remove('input-valid', 'input-invalid');
    if (icon) icon.innerText = '';
    return false;
  }

  const isValid = /^[A-Za-z\s]+$/.test(val);

  if (isValid) {
    input.classList.remove('input-invalid');
    input.classList.add('input-valid');
    if (icon) {
      icon.innerText = '✓';
      icon.style.color = '#16a34a';
    }
    return true;
  } else {
    input.classList.remove('input-valid');
    input.classList.add('input-invalid');
    if (icon) {
      icon.innerText = '✕ Letters Only';
      icon.style.color = '#dc2626';
    }
    return false;
  }
}

function showUsernameInstructions() {
  const box = document.getElementById('username-instruction-box');
  if (box) box.style.display = 'block';
}

// Live Username Checklist in Step 2 Modal
function handleLiveUsernameCheck(input) {
  const box = document.getElementById('username-instruction-box');
  if (box) box.style.display = 'block';

  const val = input.value;
  const icon = document.getElementById('user-status-icon');

  const ruleLetters = document.getElementById('rule-letters');
  const ruleNumbers = document.getElementById('rule-numbers');
  const ruleSymbols = document.getElementById('rule-symbols');
  const ruleSpaces = document.getElementById('rule-spaces');

  const hasLetter = /[A-Za-z]/.test(val);
  const hasNumber = /[0-9]/.test(val);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val);
  const hasNoSpace = !/\s/.test(val) && val.length > 0;

  updateRuleElement(ruleLetters, hasLetter);
  updateRuleElement(ruleNumbers, hasNumber);
  updateRuleElement(ruleSymbols, hasSymbol);
  updateRuleElement(ruleSpaces, hasNoSpace);

  const isAllValid = hasLetter && hasNumber && hasSymbol && hasNoSpace;

  if (isAllValid) {
    input.classList.remove('input-invalid');
    input.classList.add('input-valid');
    if (icon) {
      icon.innerText = '✓';
      icon.style.color = '#16a34a';
    }
    return true;
  } else {
    input.classList.remove('input-valid');
    if (val.length > 0) {
      input.classList.add('input-invalid');
      if (icon) {
        icon.innerText = '✕ Incomplete';
        icon.style.color = '#dc2626';
      }
    } else {
      input.classList.remove('input-invalid');
      if (icon) icon.innerText = '';
    }
    return false;
  }
}

// Live Validation when typing in Step 1 Username / Email box
function handleFormIdentifierCheck(input) {
  const val = input.value.trim();
  const box = document.getElementById('signup-username-checklist');

  // If user is entering an Email, hide the username requirements checklist
  if (val.includes('@') || globalAuthMode !== 'signup') {
    if (box) box.style.display = 'none';
    input.classList.remove('input-invalid', 'input-valid');
    return;
  }

  // If entering a Username in Sign Up mode, show checklist
  if (box) box.style.display = 'block';

  const ruleLetters = document.getElementById('rule-letters-signup');
  const ruleNumbers = document.getElementById('rule-numbers-signup');
  const ruleSymbols = document.getElementById('rule-symbols-signup');
  const ruleSpaces = document.getElementById('rule-spaces-signup');

  const hasLetter = /[A-Za-z]/.test(val);
  const hasNumber = /[0-9]/.test(val);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val);
  const hasNoSpace = !/\s/.test(val) && val.length > 0;

  updateRuleElement(ruleLetters, hasLetter);
  updateRuleElement(ruleNumbers, hasNumber);
  updateRuleElement(ruleSymbols, hasSymbol);
  updateRuleElement(ruleSpaces, hasNoSpace);

  const isAllValid = hasLetter && hasNumber && hasSymbol && hasNoSpace;

  if (isAllValid) {
    input.classList.remove('input-invalid');
    input.classList.add('input-valid');
  } else {
    input.classList.remove('input-valid');
    if (val.length > 0) input.classList.add('input-invalid');
  }
}

function updateRuleElement(el, isPassed) {
  if (!el) return;
  const ind = el.querySelector('.rule-indicator');
  if (isPassed) {
    el.classList.add('passed');
    if (ind) ind.innerText = '✓';
  } else {
    el.classList.remove('passed');
    if (ind) ind.innerText = '✕';
  }
}

// Step 1 Form Submission (Username or Email Login / Step-1 Signup)
async function handleGlobalFormSubmit(e) {
  e.preventDefault();
  const identInput = document.getElementById('auth-identifier-val');
  const passInput = document.getElementById('auth-password-val');
  const identifier = identInput ? identInput.value.trim() : '';
  const pass = passInput ? passInput.value.trim() : '';

  if (!identifier || !pass) return;

  const submitBtn = document.getElementById('auth-form-submit-btn');
  const origText = submitBtn.innerText;
  submitBtn.disabled = true;
  submitBtn.innerText = 'Processing...';

  try {
    if (globalAuthMode === 'signup') {
      // 1. SIGN UP USING EMAIL
      if (identifier.includes('@')) {
        // Basic email syntax check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(identifier)) {
          alert("Please enter a valid email address!");
          submitBtn.disabled = false;
          submitBtn.innerText = origText;
          return;
        }

        pendingSignupDetails = { email: identifier, password: pass };
        closeGlobalAuthModal();
        openProfileSetupModal(null, null, identifier);

      } else {
        // 2. SIGN UP USING USERNAME
        const hasLetter = /[A-Za-z]/.test(identifier);
        const hasNumber = /[0-9]/.test(identifier);
        const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(identifier);
        const hasNoSpace = !/\s/.test(identifier);

        if (!hasLetter || !hasNumber || !hasSymbol || !hasNoSpace) {
          alert("Username requirements check pannunga (Letters, Numbers & Special Characters kandippa irukkanum).");
          submitBtn.disabled = false;
          submitBtn.innerText = origText;
          return;
        }

        // Safe username availability check
        try {
          const userCheck = await db.collection('customers').where('username', '==', identifier).get();
          if (!userCheck.empty) {
            alert("This username is already taken! Please choose another one.");
            submitBtn.disabled = false;
            submitBtn.innerText = origText;
            return;
          }
        } catch (checkErr) {
          console.warn("Username query note:", checkErr);
        }

        pendingSignupDetails = { username: identifier, password: pass };
        closeGlobalAuthModal();
        openProfileSetupModal(null, identifier, null);
      }

    } else {
      // LOGIN MODE: Supports Username or Email
      let targetEmail = identifier;

      if (!identifier.includes('@')) {
        const query = await db.collection('customers').where('username', '==', identifier).limit(1).get();
        if (query.empty) {
          alert("No account found with this username! Please sign up.");
          submitBtn.disabled = false;
          submitBtn.innerText = origText;
          return;
        }
        targetEmail = query.docs[0].data().email;
      }

      await auth.signInWithEmailAndPassword(targetEmail, pass);
      closeGlobalAuthModal();
      if (typeof showToast === 'function') {
        showToast("Logged in successfully!", "success");
      }
    }
  } catch (err) {
    if (err.code === 'auth/wrong-password') {
      alert("Incorrect password. Please try again.");
    } else if (err.code === 'auth/user-not-found') {
      alert("No account found with this email. Please Sign up!");
    } else {
      alert("Notice: " + err.message);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = origText;
  }
}

// Step 2 Profile Completion
async function handleProfileCompletion(e) {
  e.preventDefault();
  const nameInput = document.getElementById('setup-full-name');
  const usernameInput = document.getElementById('setup-username');
  const emailInput = document.getElementById('setup-email-address');

  const isNameOk = handleLiveNameCheck(nameInput);
  const isUserOk = handleLiveUsernameCheck(usernameInput);

  if (!isNameOk) {
    nameInput.focus();
    return;
  }

  if (!isUserOk) {
    usernameInput.focus();
    return;
  }

  const nameVal = nameInput.value.trim();
  const userVal = usernameInput.value.trim();
  const emailVal = emailInput.value.trim();

  const btn = document.getElementById('setup-profile-submit-btn');
  btn.disabled = true;
  btn.innerText = "Saving Account...";

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    if (pendingSignupDetails) {
      // Create user account with Firebase Auth
      const authEmail = pendingSignupDetails.email || emailVal;
      const cred = await auth.createUserWithEmailAndPassword(authEmail, pendingSignupDetails.password);
      const user = cred.user;

      await db.collection('customers').doc(user.uid).set({
        uid: user.uid,
        name: nameVal,
        username: userVal,
        email: authEmail,
        profileImage: '',
        role: 'customer',
        createdAt: now,
        updatedAt: now
      });

      currentCustomerData = { uid: user.uid, name: nameVal, username: userVal, email: authEmail };
      pendingSignupDetails = null;

    } else {
      // Google Login Profile Completion
      const user = pendingGoogleUser || auth.currentUser;
      if (!user) return;

      await db.collection('customers').doc(user.uid).set({
        uid: user.uid,
        name: nameVal,
        username: userVal,
        email: emailVal || user.email || '',
        profileImage: user.photoURL || '',
        role: 'customer',
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      currentCustomerData = { uid: user.uid, name: nameVal, username: userVal, email: emailVal || user.email };
    }

    closeProfileSetupModal();
    renderUniversalHeader();
    if (typeof showToast === 'function') {
      showToast("Account created successfully!", "success");
    }
  } catch (err) {
    alert("Profile Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "Save & Continue";
  }
}

// Google Auth Trigger with Existing User Alert Interception
async function handleGoogleAuthTrigger() {
  isCheckingSignupExisting = true;

  try {
    const res = await auth.signInWithPopup(googleProvider);
    if (!res || !res.user) {
      isCheckingSignupExisting = false;
      return;
    }

    const loggedUser = res.user;
    const doc = await db.collection('customers').doc(loggedUser.uid).get();

    if (globalAuthMode === 'signup' && doc.exists && doc.data().username) {
      await auth.signOut();
      currentAuthUser = null;
      isCheckingSignupExisting = false;

      const alertBox = document.getElementById('auth-existing-alert');
      const defGoogle = document.getElementById('default-google-block');
      const emailText = document.getElementById('existing-user-email-text');

      if (emailText) {
        emailText.innerText = `Account (${loggedUser.email}) ஏற்கெனவே register aagirukku. Login seiyya keezhe click seiyyavum.`;
      }

      if (alertBox) alertBox.style.display = 'block';
      if (defGoogle) defGoogle.style.display = 'none';

      globalAuthMode = 'login';
      const modalTitle = document.getElementById('global-modal-title');
      if (modalTitle) modalTitle.innerText = "Account Already Exists";

      return;
    }

    isCheckingSignupExisting = false;
    closeGlobalAuthModal();

    if (!doc.exists || !doc.data().username) {
      openProfileSetupModal(loggedUser);
    } else {
      currentCustomerData = doc.data();
      currentAuthUser = loggedUser;
      renderUniversalHeader();
      if (typeof showToast === 'function') {
        showToast(`Welcome back, ${doc.data().name || loggedUser.displayName}!`, "success");
      }
    }
  } catch (err) {
    isCheckingSignupExisting = false;
    if (err.code !== 'auth/popup-closed-by-user') {
      alert("Notice: " + err.message);
    }
  }
}

async function proceedExistingUserLogin() {
  try {
    const res = await auth.signInWithPopup(googleProvider);
    if (res && res.user) {
      const doc = await db.collection('customers').doc(res.user.uid).get();
      if (doc.exists) currentCustomerData = doc.data();

      currentAuthUser = res.user;
      closeGlobalAuthModal();
      renderUniversalHeader();
      if (typeof showToast === 'function') {
        showToast(`Welcome back, ${res.user.displayName || 'User'}!`, "success");
      }
    }
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      alert(err.message);
    }
  }
}

// Open Step 2 Profile Setup Modal
function openProfileSetupModal(user, prefilledUsername, prefilledEmail) {
  pendingGoogleUser = user;
  const m = document.getElementById('google-profile-setup-modal');
  if (m) {
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const nameInput = document.getElementById('setup-full-name');
    const userInput = document.getElementById('setup-username');
    const emailInput = document.getElementById('setup-email-address');

    if (user) {
      // Google Login Profile Setup
      if (nameInput && user.displayName) {
        nameInput.value = user.displayName.replace(/[^a-zA-Z\s]/g, '');
        handleLiveNameCheck(nameInput);
      }
      if (emailInput && user.email) {
        emailInput.value = user.email;
        emailInput.readOnly = true;
      }
      if (userInput) {
        userInput.readOnly = false;
        userInput.value = '';
      }
    } else {
      // Custom Registration Flow
      if (prefilledUsername && userInput) {
        // User entered username in step 1 -> fix username, let them enter email
        userInput.value = prefilledUsername;
        userInput.readOnly = true;
        handleLiveUsernameCheck(userInput);
        if (emailInput) {
          emailInput.value = '';
          emailInput.readOnly = false;
        }
      } else if (prefilledEmail && emailInput) {
        // User entered email in step 1 -> fix email, let them choose username
        emailInput.value = prefilledEmail;
        emailInput.readOnly = true;
        if (userInput) {
          userInput.value = '';
          userInput.readOnly = false;
        }
      }
    }
  }
}

function closeProfileSetupModal() {
  const m = document.getElementById('google-profile-setup-modal');
  if (m) {
    m.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function toggleGlobalMenu(e) {
  if (e) e.stopPropagation();
  const list = document.getElementById('global-menu-list');
  if (list) list.classList.toggle('show');
}

window.addEventListener('click', function(e) {
  const dropdown = document.getElementById('global-nav-dropdown');
  const list = document.getElementById('global-menu-list');
  if (list && dropdown && !dropdown.contains(e.target)) {
    list.classList.remove('show');
  }
});

function openGlobalAuthModal(mode) {
  globalAuthMode = mode || 'signup';
  
  const alertBox = document.getElementById('auth-existing-alert');
  const defGoogle = document.getElementById('default-google-block');
  if (alertBox) alertBox.style.display = 'none';
  if (defGoogle) defGoogle.style.display = 'block';

  updateGlobalAuthUI();
  const m = document.getElementById('global-auth-modal');
  if (m) {
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeGlobalAuthModal() {
  const m = document.getElementById('global-auth-modal');
  if (m) {
    m.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function toggleGlobalAuthMode() {
  globalAuthMode = (globalAuthMode === 'signup') ? 'login' : 'signup';
  const alertBox = document.getElementById('auth-existing-alert');
  const defGoogle = document.getElementById('default-google-block');
  if (alertBox) alertBox.style.display = 'none';
  if (defGoogle) defGoogle.style.display = 'block';
  updateGlobalAuthUI();
}

function updateGlobalAuthUI() {
  const title = document.getElementById('global-modal-title');
  const submitBtn = document.getElementById('auth-form-submit-btn');
  const switchLabel = document.getElementById('auth-switch-label');
  const switchBtn = document.getElementById('auth-switch-btn');
  const identLabel = document.getElementById('auth-identifier-label');
  const identInput = document.getElementById('auth-identifier-val');
  const checkList = document.getElementById('signup-username-checklist');

  if (!title || !submitBtn) return;

  if (identLabel) identLabel.innerText = 'Username / Email';
  if (identInput) identInput.placeholder = 'Enter your username or email';

  if (globalAuthMode === 'signup') {
    title.innerText = 'Create an Account';
    submitBtn.innerText = 'Continue';
    switchLabel.innerText = 'Already have an account? ';
    switchBtn.innerText = 'Login';
  } else {
    title.innerText = 'Welcome Back';
    submitBtn.innerText = 'Login';
    switchLabel.innerText = "Don't have an account? ";
    switchBtn.innerText = 'Sign up';
    if (checkList) checkList.style.display = 'none';
  }
}

async function logoutUser() {
  try {
    await auth.signOut();
    currentCustomerData = null;
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
  }
}

async function syncCustomerProfile(user) {
  if (!db) return;
  const customerRef = db.collection('customers').doc(user.uid);
  const doc = await customerRef.get();
  if (doc.exists) {
    currentCustomerData = doc.data();
  }
}

async function fetchSellerProfile(uid) {
  if (!db) return null;
  try {
    const doc = await db.collection('sellers').doc(uid).get();
    currentSellerData = doc.exists ? doc.data() : null;
    return currentSellerData;
  } catch (e) {
    return null;
  }
}

function renderFloatingNovaWidget() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  if (currentPath === 'ai-support.html') return;

  if (!document.getElementById('nova-floating-widget')) {
    const widget = document.createElement('a');
    widget.id = 'nova-floating-widget';
    widget.className = 'nova-floating-btn';
    widget.href = 'ai-support.html';
    widget.innerHTML = `
      <div class="nova-floating-icon">🦢</div>
      <span class="nova-floating-label">Ask NOVA AI</span>
    `;
    document.body.appendChild(widget);
  }
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

document.addEventListener('DOMContentLoaded', initAuth);

// Global Exports
window.toggleGlobalMenu = toggleGlobalMenu;
window.openGlobalAuthModal = openGlobalAuthModal;
window.closeGlobalAuthModal = closeGlobalAuthModal;
window.toggleGlobalAuthMode = toggleGlobalAuthMode;
window.handleGlobalFormSubmit = handleGlobalFormSubmit;
window.handleGoogleAuthTrigger = handleGoogleAuthTrigger;
window.proceedExistingUserLogin = proceedExistingUserLogin;
window.logoutUser = logoutUser;
window.handleLiveNameCheck = handleLiveNameCheck;
window.showUsernameInstructions = showUsernameInstructions;
window.handleLiveUsernameCheck = handleLiveUsernameCheck;
window.handleFormIdentifierCheck = handleFormIdentifierCheck;
window.handleProfileCompletion = handleProfileCompletion;
window.closeProfileSetupModal = closeProfileSetupModal;