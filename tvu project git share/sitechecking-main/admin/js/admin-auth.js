/**
 * TVU Books & Materials - Admin Authentication & Authorization Guard
 * Enforces role-based access to the Academic Admin Panel.
 * Validates against Firestore admins collection or user role.
 */

// Authorized Admin Verification
async function verifyIsAdmin(user) {
  if (!user || !user.uid) return false;

  try {
    // 1. Check if user document exists in admins collection
    const adminDoc = await db.collection('admins').doc(user.uid).get();
    if (adminDoc.exists && adminDoc.data().isActive !== false) {
      return true;
    }

    // 2. Check if customer profile has role 'admin'
    const customerDoc = await db.collection('customers').doc(user.uid).get();
    if (customerDoc.exists && customerDoc.data().role === 'admin') {
      return true;
    }

    // 3. Optional fallback: If admins collection is empty (fresh setup), allow initial authorized developer/admin email setup
    const adminsSnapshot = await db.collection('admins').limit(1).get();
    if (adminsSnapshot.empty) {
      // First user to sign into admin portal can be provisioned as initial super admin
      await db.collection('admins').doc(user.uid).set({
        email: user.email || '',
        name: user.displayName || 'Administrator',
        role: 'super_admin',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });
      return true;
    }

  } catch (error) {
    console.error("Admin verification check error:", error);
  }

  return false;
}

// Guard for dashboard.html
async function requireAdminAuth() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // Not logged in -> redirect to admin login
      window.location.href = 'login.html';
      return;
    }

    const isAdmin = await verifyIsAdmin(user);

    if (!isAdmin) {
      // Authenticated but unauthorized
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b1d33; color: #ffffff; font-family: sans-serif; text-align: center; padding: 2rem;">
          <div style="background: #ffffff; color: #1e293b; padding: 3rem; border-radius: 12px; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">🚫</div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #dc2626; margin-bottom: 0.5rem;">Access Denied</h2>
            <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
              You do not have administrator permissions for TVU Books & Materials Academic Portal.
            </p>
            <div style="font-size: 0.8rem; background: #f1f5f9; padding: 0.75rem; border-radius: 6px; margin-bottom: 1.5rem; word-break: break-all;">
              Signed in as: <strong>${user.email || user.uid}</strong>
            </div>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
              <button onclick="logoutAdmin()" style="background: #0f2744; color: #ffffff; border: none; padding: 0.75rem 1.25rem; border-radius: 6px; font-weight: 700; cursor: pointer;">
                Switch Account
              </button>
              <a href="../index.html" style="background: #e2e8f0; color: #1e293b; text-decoration: none; padding: 0.75rem 1.25rem; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center;">
                Return to Store
              </a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Authorized Admin -> Initialize dashboard
    const adminNameEl = document.getElementById('admin-display-name');
    const adminEmailEl = document.getElementById('admin-display-email');
    if (adminNameEl) adminNameEl.textContent = user.displayName || 'Administrator';
    if (adminEmailEl) adminEmailEl.textContent = user.email || '';

    if (typeof window.initAdminDashboard === 'function') {
      window.initAdminDashboard(user);
    }
  });
}

// Admin Google Sign-In
async function loginAdminWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    const isAdmin = await verifyIsAdmin(user);
    if (isAdmin) {
      window.location.href = 'dashboard.html';
    } else {
      showAdminAlert("Access denied. Your account is not authorized as an administrator.", "error");
    }
  } catch (error) {
    console.error("Admin login error:", error);
    showAdminAlert(error.message || "Failed to sign in with Google.", "error");
  }
}

// Admin Logout
async function logoutAdmin() {
  try {
    await auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Logout error:", error);
  }
}

function showAdminAlert(message, type = 'info') {
  const alertBox = document.getElementById('admin-login-alert');
  if (alertBox) {
    alertBox.textContent = message;
    alertBox.style.display = 'block';
    alertBox.style.background = type === 'error' ? '#fee2e2' : '#e0f2fe';
    alertBox.style.color = type === 'error' ? '#991b1b' : '#0369a1';
    alertBox.style.padding = '0.75rem';
    alertBox.style.borderRadius = '6px';
    alertBox.style.marginBottom = '1rem';
    alertBox.style.fontSize = '0.85rem';
    alertBox.style.fontWeight = '600';
  } else {
    alert(message);
  }
}

window.verifyIsAdmin = verifyIsAdmin;
window.requireAdminAuth = requireAdminAuth;
window.loginAdminWithGoogle = loginAdminWithGoogle;
window.logoutAdmin = logoutAdmin;
