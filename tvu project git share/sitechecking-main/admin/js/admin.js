/**
 * TVU Books & Materials - Executive Admin Dashboard Controller
 */

let currentAdminUser = null;
let currentPendingPapers = [];
let currentApprovedPapers = [];
let currentRejectedPapers = [];
let currentSyllabuses = [];
let activeRejectPaperId = null;
let activeEditSyllabusId = null;

async function initAdminDashboard(user) {
  currentAdminUser = user;
  showAdminSection('pending');
  await refreshDashboardData();
}

async function refreshDashboardData() {
  await Promise.all([
    loadAllQuestionPapers(),
    loadAdminSyllabuses()
  ]);
  updateStatsCounters();
}

function showAdminSection(sectionName) {
  ['pending', 'approved', 'rejected', 'syllabuses'].forEach(s => {
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

  tbody.innerHTML = currentPendingPapers.map(p => `
    <tr>
      <td>
        <div style="font-weight:700; color:var(--admin-primary);">${escapeHtml(p.subjectName)}</div>
        <div style="font-size:0.75rem; color:var(--admin-muted);">${p.subjectCode ? `Code: ${escapeHtml(p.subjectCode)}` : ''}</div>
      </td>
      <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${escapeHtml(p.department)}</span></td>
      <td><span style="font-weight:700;">${escapeHtml(p.examYear || 'N/A')}</span></td>
      <td>
        <div style="font-weight:600;">${escapeHtml(p.uploadedByName || 'Student')}</div>
        <div style="font-size:0.725rem; color:var(--admin-muted);">${escapeHtml(p.uploaderEmail || '')}</div>
      </td>
      <td>
        <a href="${escapeHtml(p.fileUrl || '#')}" target="_blank" class="btn-admin btn-preview">Preview PDF</a>
      </td>
      <td>
        <div class="btn-action-group">
          <button class="btn-admin btn-approve" onclick="approveQuestionPaper('${p.id}')">✓ Approve</button>
          <button class="btn-admin btn-reject" onclick="openRejectModal('${p.id}', '${escapeHtml(p.subjectName)}')">✕ Reject</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function approveQuestionPaper(paperId) {
  if (!confirm("Approve and publish this question paper for public student access?")) return;
  try {
    await db.collection('questionPapers').doc(paperId).update({
      status: 'approved',
      isActive: true,
      reviewedBy: currentAdminUser ? currentAdminUser.uid : 'admin',
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Question paper approved!");
    await loadAllQuestionPapers();
  } catch (error) {
    alert("Approval error: " + error.message);
  }
}

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
}

async function confirmRejectQuestionPaper() {
  if (!activeRejectPaperId) return;
  const reason = (document.getElementById('reject-reason-input').value || '').trim();

  try {
    await db.collection('questionPapers').doc(activeRejectPaperId).update({
      status: 'rejected',
      isActive: false,
      rejectionReason: reason || 'Not approved by administrator.',
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeRejectModal();
    alert("Submission rejected.");
    await loadAllQuestionPapers();
  } catch (error) {
    alert("Rejection error: " + error.message);
  }
}

function renderApprovedTable() {
  const tbody = document.getElementById('approved-papers-tbody');
  if (!tbody) return;

  if (currentApprovedPapers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">No approved question papers yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentApprovedPapers.map(p => `
    <tr>
      <td style="font-weight:700;">${escapeHtml(p.subjectName)}</td>
      <td><span class="badge badge-approved">${escapeHtml(p.department)}</span></td>
      <td>${escapeHtml(p.examYear || '')}</td>
      <td><a href="${escapeHtml(p.fileUrl || '#')}" target="_blank" class="btn-admin btn-preview">View PDF</a></td>
      <td>
        <button class="btn-admin btn-reject" onclick="deleteQuestionPaper('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function renderRejectedTable() {
  const tbody = document.getElementById('rejected-papers-tbody');
  if (!tbody) return;

  if (currentRejectedPapers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">No rejected submissions.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentRejectedPapers.map(p => `
    <tr>
      <td style="font-weight:700;">${escapeHtml(p.subjectName)}</td>
      <td>${escapeHtml(p.department)}</td>
      <td style="color:var(--admin-danger);">${escapeHtml(p.rejectionReason || 'Ineligible')}</td>
      <td>
        <button class="btn-admin btn-approve" onclick="approveQuestionPaper('${p.id}')">Re-Approve</button>
        <button class="btn-admin btn-reject" onclick="deleteQuestionPaper('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function deleteQuestionPaper(paperId) {
  if (!confirm("Permanently delete this question paper record?")) return;
  try {
    await db.collection('questionPapers').doc(paperId).delete();
    await loadAllQuestionPapers();
  } catch (error) {
    alert("Delete failed: " + error.message);
  }
}

async function loadAdminSyllabuses() {
  try {
    const snapshot = await db.collection('syllabuses').get();
    currentSyllabuses = [];
    snapshot.forEach(doc => currentSyllabuses.push({ id: doc.id, ...doc.data() }));
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">No department syllabuses found.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentSyllabuses.map(s => `
    <tr>
      <td style="font-weight:700;">${escapeHtml(s.department)}</td>
      <td>${escapeHtml(s.syllabusTitle || 'Complete Syllabus')}</td>
      <td><span class="badge badge-approved">${escapeHtml(s.regulation || 'CBCS')}</span></td>
      <td><a href="${escapeHtml(s.pdfUrl || '#')}" target="_blank" class="btn-admin btn-preview">View PDF</a></td>
      <td>
        <button class="btn-admin btn-reject" onclick="deleteSyllabus('${s.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function deleteSyllabus(syllabusId) {
  if (!confirm("Permanently delete this department syllabus?")) return;
  try {
    await db.collection('syllabuses').doc(syllabusId).delete();
    await loadAdminSyllabuses();
  } catch (error) {
    alert("Failed to delete syllabus: " + error.message);
  }
}

function updateStatsCounters() {
  const pCount = document.getElementById('stat-pending-count');
  const aCount = document.getElementById('stat-approved-count');
  const sCount = document.getElementById('stat-syllabus-count');
  const badge = document.getElementById('nav-pending-badge');

  if (pCount) pCount.textContent = currentPendingPapers.length;
  if (aCount) aCount.textContent = currentApprovedPapers.length;
  if (sCount) sCount.textContent = currentSyllabuses.length;

  if (badge) {
    badge.textContent = currentPendingPapers.length;
    badge.style.display = currentPendingPapers.length > 0 ? 'inline-block' : 'none';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.initAdminDashboard = initAdminDashboard;
window.showAdminSection = showAdminSection;
window.approveQuestionPaper = approveQuestionPaper;
window.openRejectModal = openRejectModal;
window.closeRejectModal = closeRejectModal;
window.confirmRejectQuestionPaper = confirmRejectQuestionPaper;
window.deleteQuestionPaper = deleteQuestionPaper;
window.deleteSyllabus = deleteSyllabus;
window.refreshDashboardData = refreshDashboardData;