/**
 * TVU Books & Materials - Admin Authentication Guard
 */

async function verifyIsAdmin(user) {
  if (!user || !user.uid) return false;

  try {
    const adminDoc = await db.collection('admins').doc(user.uid).get();
    if (adminDoc.exists && adminDoc.data().isActive !== false) {
      return true;
    }

    const customerDoc = await db.collection('customers').doc(user.uid).get();
    if (customerDoc.exists && customerDoc.data().role === 'admin') {
      return true;
    }

    const adminsSnapshot = await db.collection('admins').limit(1).get();
    if (adminsSnapshot.empty) {
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

async function requireAdminAuth() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const isAdmin = await verifyIsAdmin(user);
    if (!isAdmin) {
      document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1d33;color:#fff;text-align:center;padding:2rem;">
          <div style="background:#fff;color:#1e293b;padding:3rem;border-radius:12px;max-width:480px;">
            <div style="font-size:3rem;">🚫</div>
            <h2 style="color:#dc2626;margin:1rem 0;">Access Denied</h2>
            <p style="color:#64748b;margin-bottom:1.5rem;">You do not have administrator privileges for TVU Academic Portal.</p>
            <a href="../index.html" style="background:#0f2744;color:#fff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:6px;font-weight:700;">Return to Store</a>
          </div>
        </div>
      `;
      return;
    }

    const adminNameEl = document.getElementById('admin-display-name');
    const adminEmailEl = document.getElementById('admin-display-email');
    if (adminNameEl) adminNameEl.textContent = user.displayName || 'Administrator';
    if (adminEmailEl) adminEmailEl.textContent = user.email || '';

    if (typeof window.initAdminDashboard === 'function') {
      window.initAdminDashboard(user);
    }
  });
}

async function loginAdminWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const isAdmin = await verifyIsAdmin(result.user);
    if (isAdmin) {
      window.location.href = 'dashboard.html';
    } else {
      alert("Access denied. Your account is not authorized as an administrator.");
    }
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}

async function logoutAdmin() {
  try {
    await auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Logout error:", error);
  }
}

window.verifyIsAdmin = verifyIsAdmin;
window.requireAdminAuth = requireAdminAuth;
window.loginAdminWithGoogle = loginAdminWithGoogle;
window.logoutAdmin = logoutAdmin;