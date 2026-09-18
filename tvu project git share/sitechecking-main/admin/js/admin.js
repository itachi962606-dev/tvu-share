/**
 * TVU Books & Materials - Executive Admin Dashboard Controller
 * Handles Question Paper moderation (Pending/Approved/Rejected) and Syllabus PDF management.
 */

let currentAdminUser = null;
let currentPendingPapers = [];
let currentApprovedPapers = [];
let currentRejectedPapers = [];
let currentSyllabuses = [];

let activeRejectPaperId = null;
let activeEditSyllabusId = null;

// Initialize Dashboard after Auth Guard passes
async function initAdminDashboard(user) {
  currentAdminUser = user;
  showAdminSection('pending');
  await refreshDashboardData();
}

// Refresh all data
async function refreshDashboardData() {
  await Promise.all([
    loadAllQuestionPapers(),
    loadAdminSyllabuses()
  ]);
  updateStatsCounters();
}

// Navigation between Admin Sections
function showAdminSection(sectionName) {
  const sections = ['pending', 'approved', 'rejected', 'syllabuses'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    const navBtn = document.getElementById(`nav-btn-${s}`);
    if (el) el.style.display = (s === sectionName) ? 'block' : 'none';
    if (navBtn) {
      if (s === sectionName) navBtn.classList.add('active');
      else navBtn.classList.remove('active');
    }
  });

  const pageTitle = document.getElementById('admin-page-heading');
  if (pageTitle) {
    switch (sectionName) {
      case 'pending': pageTitle.textContent = 'Pending Question Paper Reviews'; break;
      case 'approved': pageTitle.textContent = 'Approved & Published Question Papers'; break;
      case 'rejected': pageTitle.textContent = 'Rejected Submissions'; break;
      case 'syllabuses': pageTitle.textContent = 'Department Regulation Syllabus Management'; break;
    }
  }
}

// =========================================================================
// 1. QUESTION PAPERS MODERATION (Pending / Approved / Rejected)
// =========================================================================

async function loadAllQuestionPapers() {
  try {
    const snapshot = await db.collection('questionPapers').get();
    currentPendingPapers = [];
    currentApprovedPapers = [];
    currentRejectedPapers = [];

    snapshot.forEach(doc => {
      const p = { id: doc.id, ...doc.data() };
      const status = p.status || 'pending';

      if (status === 'pending') currentPendingPapers.push(p);
      else if (status === 'approved') currentApprovedPapers.push(p);
      else if (status === 'rejected') currentRejectedPapers.push(p);
    });

    renderPendingTable();
    renderApprovedTable();
    renderRejectedTable();
    updateStatsCounters();

  } catch (error) {
    console.error("Error loading question papers:", error);
  }
}

// Render Pending Table
function renderPendingTable() {
  const tbody = document.getElementById('pending-papers-tbody');
  const emptyEl = document.getElementById('pending-empty-state');
  if (!tbody) return;

  if (currentPendingPapers.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = currentPendingPapers.map(p => {
    const fileUrl = p.fileUrl || '#';
    const dateStr = p.uploadedAt && p.uploadedAt.toDate ? p.uploadedAt.toDate().toLocaleDateString('en-IN') : 'Recent';

    return `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--admin-primary);">${escapeHtml(p.subjectName)}</div>
          <div style="font-size:0.75rem; color:var(--admin-muted);">${p.subjectCode ? `Code: ${escapeHtml(p.subjectCode)}` : ''}</div>
        </td>
        <td>
          <span class="badge" style="background:#e0f2fe; color:#0369a1;">${escapeHtml(p.department)}</span>
        </td>
        <td>
          <span style="font-weight:700;">${escapeHtml(p.examYear || 'N/A')}</span>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(p.uploadedByName || 'Student')}</div>
          <div style="font-size:0.725rem; color:var(--admin-muted);">${escapeHtml(p.uploaderEmail || '')}</div>
        </td>
        <td>${dateStr}</td>
        <td>
          <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" class="btn-admin btn-preview">
            <span>📄</span> Preview PDF
          </a>
        </td>
        <td>
          <div class="btn-action-group">
            <button class="btn-admin btn-approve" onclick="approveQuestionPaper('${p.id}')">
              <span>✓</span> Approve
            </button>
            <button class="btn-admin btn-reject" onclick="openRejectModal('${p.id}', '${escapeHtml(p.subjectName)}')">
              <span>✕</span> Reject
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Approve Question Paper
async function approveQuestionPaper(paperId) {
  if (!confirm("Approve and publish this question paper for public student access?")) return;

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('questionPapers').doc(paperId).update({
      status: 'approved',
      isActive: true,
      reviewedBy: currentAdminUser ? currentAdminUser.uid : 'admin',
      reviewedByName: currentAdminUser ? currentAdminUser.displayName : 'Admin',
      reviewedAt: now,
      rejectionReason: ''
    });

    alert("Question paper approved and published successfully!");
    await loadAllQuestionPapers();
  } catch (error) {
    console.error("Approval error:", error);
    alert("Failed to approve question paper: " + error.message);
  }
}

// Open Rejection Modal
function openRejectModal(paperId, subjectName) {
  activeRejectPaperId = paperId;
  const nameEl = document.getElementById('reject-subject-title');
  if (nameEl) nameEl.textContent = subjectName;
  const modal = document.getElementById('admin-reject-modal');
  if (modal) modal.classList.add('show');
}

function closeRejectModal() {
  activeRejectPaperId = null;
  const modal = document.getElementById('admin-reject-modal');
  if (modal) modal.classList.remove('show');
  const reasonInput = document.getElementById('reject-reason-input');
  if (reasonInput) reasonInput.value = '';
}

// Confirm Rejection
async function confirmRejectQuestionPaper() {
  if (!activeRejectPaperId) return;
  const reason = (document.getElementById('reject-reason-input').value || '').trim();

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('questionPapers').doc(activeRejectPaperId).update({
      status: 'rejected',
      isActive: false,
      rejectionReason: reason || 'Not approved by administrator.',
      reviewedBy: currentAdminUser ? currentAdminUser.uid : 'admin',
      reviewedByName: currentAdminUser ? currentAdminUser.displayName : 'Admin',
      reviewedAt: now
    });

    closeRejectModal();
    alert("Submission rejected.");
    await loadAllQuestionPapers();
  } catch (error) {
    console.error("Rejection error:", error);
    alert("Failed to reject submission: " + error.message);
  }
}

// Render Approved Table
function renderApprovedTable() {
  const tbody = document.getElementById('approved-papers-tbody');
  if (!tbody) return;

  if (currentApprovedPapers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--admin-muted);">No approved question papers yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentApprovedPapers.map(p => {
    const fileUrl = p.fileUrl || '#';

    return `
      <tr>
        <td style="font-weight:700;">${escapeHtml(p.subjectName)}</td>
        <td><span class="badge badge-approved">${escapeHtml(p.department)}</span></td>
        <td>${escapeHtml(p.examYear || '')}</td>
        <td><span class="badge ${p.isActive ? 'badge-approved' : 'badge-rejected'}">${p.isActive ? 'Active' : 'Hidden'}</span></td>
        <td>
          <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" class="btn-admin btn-preview">
            <span>📄</span> View PDF
          </a>
        </td>
        <td>
          <div class="btn-action-group">
            <button class="btn-admin btn-reject" onclick="deleteQuestionPaper('${p.id}')">
              <span>🗑️</span> Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Rejected Table
function renderRejectedTable() {
  const tbody = document.getElementById('rejected-papers-tbody');
  if (!tbody) return;

  if (currentRejectedPapers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--admin-muted);">No rejected submissions.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentRejectedPapers.map(p => {
    return `
      <tr>
        <td style="font-weight:700;">${escapeHtml(p.subjectName)}</td>
        <td>${escapeHtml(p.department)}</td>
        <td style="color:var(--admin-danger); font-size:0.85rem;">${escapeHtml(p.rejectionReason || 'Ineligible resource')}</td>
        <td>
          <button class="btn-admin btn-approve" onclick="approveQuestionPaper('${p.id}')">
            <span>✓</span> Re-Approve
          </button>
          <button class="btn-admin btn-reject" onclick="deleteQuestionPaper('${p.id}')">
            <span>🗑️</span> Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteQuestionPaper(paperId) {
  if (!confirm("Are you sure you want to permanently delete this question paper record?")) return;

  try {
    await db.collection('questionPapers').doc(paperId).delete();
    alert("Record deleted successfully.");
    await loadAllQuestionPapers();
  } catch (error) {
    console.error("Delete error:", error);
    alert("Delete failed: " + error.message);
  }
}

// =========================================================================
// 2. DEPARTMENT SYLLABUS MANAGEMENT
// =========================================================================

async function loadAdminSyllabuses() {
  try {
    const snapshot = await db.collection('syllabuses').get();
    currentSyllabuses = [];

    snapshot.forEach(doc => {
      currentSyllabuses.push({ id: doc.id, ...doc.data() });
    });

    renderSyllabusTable();
    updateStatsCounters();

  } catch (error) {
    console.error("Error loading syllabuses:", error);
  }
}

function renderSyllabusTable() {
  const tbody = document.getElementById('syllabuses-tbody');
  if (!tbody) return;

  if (currentSyllabuses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--admin-muted);">No department syllabuses in database yet. Click "+ Upload Department Syllabus" to add.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentSyllabuses.map(s => {
    const pdfUrl = s.pdfUrl || '#';

    return `
      <tr>
        <td style="font-weight:700; color:var(--admin-primary);">${escapeHtml(s.department)}</td>
        <td>${escapeHtml(s.syllabusTitle || 'Complete Regulation Syllabus')}</td>
        <td><span class="badge badge-approved">${escapeHtml(s.regulation || 'CBCS')}</span></td>
        <td>
          <a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn-admin btn-preview">
            <span>📄</span> View PDF
          </a>
        </td>
        <td>
          <div class="btn-action-group">
            <button class="btn-admin btn-primary-admin" onclick="openEditSyllabusModal('${s.id}')">
              <span>✏️</span> Edit
            </button>
            <button class="btn-admin btn-reject" onclick="deleteSyllabus('${s.id}')">
              <span>🗑️</span> Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Syllabus Upload Modal
function openAddSyllabusModal() {
  activeEditSyllabusId = null;
  document.getElementById('syllabus-modal-title').textContent = 'Upload Department Complete Syllabus PDF';
  document.getElementById('admin-syllabus-form').reset();
  const modal = document.getElementById('admin-syllabus-modal');
  if (modal) modal.classList.add('show');
}

function openEditSyllabusModal(syllabusId) {
  activeEditSyllabusId = syllabusId;
  const s = currentSyllabuses.find(item => item.id === syllabusId);
  if (!s) return;

  document.getElementById('syllabus-modal-title').textContent = `Edit Syllabus: ${s.department}`;
  document.getElementById('admin-syl-dept').value = s.department || '';
  document.getElementById('admin-syl-title').value = s.syllabusTitle || '';
  document.getElementById('admin-syl-regulation').value = s.regulation || '';
  document.getElementById('admin-syl-pdf').value = s.pdfUrl || '';
  document.getElementById('admin-syl-desc').value = s.description || '';

  const modal = document.getElementById('admin-syllabus-modal');
  if (modal) modal.classList.add('show');
}

function closeSyllabusModal() {
  activeEditSyllabusId = null;
  const modal = document.getElementById('admin-syllabus-modal');
  if (modal) modal.classList.remove('show');
}

async function handleAdminSyllabusSubmit(e) {
  e.preventDefault();

  const dept = document.getElementById('admin-syl-dept').value.trim();
  const title = document.getElementById('admin-syl-title').value.trim() || 'Complete Regulation Syllabus (All Semesters)';
  const regulation = document.getElementById('admin-syl-regulation').value.trim() || 'CBCS Regulation';
  const pdfUrl = document.getElementById('admin-syl-pdf').value.trim();
  const desc = document.getElementById('admin-syl-desc').value.trim() || `Official complete academic syllabus document for ${dept} (All Semesters).`;

  if (!dept || !pdfUrl) {
    alert("Department and PDF URL are required.");
    return;
  }

  try {
    const payload = {
      department: dept,
      syllabusTitle: title,
      regulation: regulation,
      pdfUrl: pdfUrl,
      description: desc,
      fileSize: 'Complete PDF',
      isActive: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (activeEditSyllabusId) {
      await db.collection('syllabuses').doc(activeEditSyllabusId).update(payload);
      alert("Syllabus updated successfully!");
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('syllabuses').add(payload);
      alert("New department syllabus published successfully!");
    }

    closeSyllabusModal();
    await loadAdminSyllabuses();

  } catch (error) {
    console.error("Syllabus save error:", error);
    alert("Failed to save syllabus: " + error.message);
  }
}

async function deleteSyllabus(syllabusId) {
  if (!confirm("Are you sure you want to delete this department syllabus?")) return;

  try {
    await db.collection('syllabuses').doc(syllabusId).delete();
    alert("Syllabus deleted successfully.");
    await loadAdminSyllabuses();
  } catch (error) {
    console.error("Delete syllabus error:", error);
    alert("Failed to delete syllabus: " + error.message);
  }
}

// Update Dashboard Header Stats
function updateStatsCounters() {
  const pendingCountEl = document.getElementById('stat-pending-count');
  const approvedCountEl = document.getElementById('stat-approved-count');
  const syllabusCountEl = document.getElementById('stat-syllabus-count');
  const navBadge = document.getElementById('nav-pending-badge');

  if (pendingCountEl) pendingCountEl.textContent = currentPendingPapers.length;
  if (approvedCountEl) approvedCountEl.textContent = currentApprovedPapers.length;
  if (syllabusCountEl) syllabusCountEl.textContent = currentSyllabuses.length;

  if (navBadge) {
    navBadge.textContent = currentPendingPapers.length;
    navBadge.style.display = currentPendingPapers.length > 0 ? 'inline-block' : 'none';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.initAdminDashboard = initAdminDashboard;
window.showAdminSection = showAdminSection;
window.approveQuestionPaper = approveQuestionPaper;
window.openRejectModal = openRejectModal;
window.closeRejectModal = closeRejectModal;
window.confirmRejectQuestionPaper = confirmRejectQuestionPaper;
window.deleteQuestionPaper = deleteQuestionPaper;
window.openAddSyllabusModal = openAddSyllabusModal;
window.openEditSyllabusModal = openEditSyllabusModal;
window.closeSyllabusModal = closeSyllabusModal;
window.handleAdminSyllabusSubmit = handleAdminSyllabusSubmit;
window.deleteSyllabus = deleteSyllabus;
window.refreshDashboardData = refreshDashboardData;
