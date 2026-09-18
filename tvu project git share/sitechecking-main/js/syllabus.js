/**
 * TVU Books & Materials - Download Syllabus & Question Papers Public Controller
 * Enforces:
 * 1. Department-based complete regulation syllabus PDFs (all semesters).
 * 2. Public Question Papers list shows strictly APPROVED & ACTIVE records only.
 * 3. Dynamic department filters extracted ONLY from approved question papers.
 * 4. User Question Paper submissions saved with status: "pending" for Admin review.
 */

// State
let allSyllabuses = [];
let approvedQuestionPapers = [];
let filteredSyllabuses = [];
let filteredQuestionPapers = [];
let selectedQpDepartment = 'All';
let currentActiveTab = 'syllabus';

// Department Icon Map
const DEPT_ICONS = {
  'Computer Science': '💻',
  'Mathematics': '📐',
  'Commerce': '📊',
  'Physics': '⚡',
  'Chemistry': '🧪',
  'English': '📖',
  'Tamil': '📜',
  'Management': '💼',
  'Economics': '📈',
  'History': '🏛️',
  'Botany': '🌿',
  'Zoology': '🔬'
};

function getDeptIcon(deptName = '') {
  for (const [key, icon] of Object.entries(DEPT_ICONS)) {
    if (deptName.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  return '📚';
}

// Fallback seed data for immediate testing if Firestore has no records
const DEFAULT_SYLLABUS_SEEDS = [
  {
    id: 'syl_cs_cbcs',
    department: 'B.Sc Computer Science',
    syllabusTitle: 'Complete CBCS Regulation Syllabus (All Semesters)',
    regulation: '2023 - 2026 CBCS Regulation',
    description: 'Complete official syllabus covering all 6 semesters: Programming in C, C++, Data Structures, Java, Python, DBMS, Operating Systems, Web Technology, and Computer Networks.',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    fileSize: '3.2 MB',
    isActive: true
  },
  {
    id: 'syl_com_cbcs',
    department: 'B.Com General',
    syllabusTitle: 'Complete Regulation Syllabus (All Semesters)',
    regulation: '2023 - 2026 CBCS Regulation',
    description: 'Comprehensive curriculum for all semesters: Financial Accounting, Corporate Accounting, Business Law, Banking Theory, Cost Accounting, Management Accounting, and Taxation.',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    fileSize: '2.8 MB',
    isActive: true
  },
  {
    id: 'syl_math_cbcs',
    department: 'B.Sc Mathematics',
    syllabusTitle: 'Complete Mathematics Syllabus (All Semesters)',
    regulation: '2023 - 2026 CBCS Regulation',
    description: 'Official university curriculum: Algebra, Calculus, Differential Equations, Vector Calculus, Real Analysis, Complex Analysis, Mechanics, and Numerical Methods.',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    fileSize: '2.5 MB',
    isActive: true
  },
  {
    id: 'syl_eng_cbcs',
    department: 'B.A English Literature',
    syllabusTitle: 'Complete English Literature Syllabus (All Semesters)',
    regulation: '2023 - 2026 CBCS Regulation',
    description: 'All 6 semesters syllabus: Social History of England, Elizabethan Age, Victorian Age, Shakespeare Studies, Indian Writing in English, and Literary Criticism.',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    fileSize: '2.1 MB',
    isActive: true
  },
  {
    id: 'syl_phy_cbcs',
    department: 'B.Sc Physics',
    syllabusTitle: 'Complete Physics Syllabus (All Semesters)',
    regulation: '2023 - 2026 CBCS Regulation',
    description: 'Complete 6 semesters syllabus: Properties of Matter, Thermal Physics, Optics & Spectroscopy, Electricity & Magnetism, Quantum Mechanics, and Nuclear Physics.',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    fileSize: '2.9 MB',
    isActive: true
  }
];

const DEFAULT_APPROVED_QP_SEEDS = [
  {
    id: 'qp_cs_ds_2024',
    department: 'B.Sc Computer Science',
    subjectName: 'Data Structures and Algorithms',
    subjectCode: 'CS301',
    examYear: 'November 2024',
    fileName: 'BSc_CS_DataStructures_Nov2024.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    status: 'approved',
    isActive: true
  },
  {
    id: 'qp_cs_java_2024',
    department: 'B.Sc Computer Science',
    subjectName: 'Java Programming',
    subjectCode: 'CS401',
    examYear: 'April 2024',
    fileName: 'BSc_CS_Java_Apr2024.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    status: 'approved',
    isActive: true
  },
  {
    id: 'qp_cs_dbms_2023',
    department: 'B.Sc Computer Science',
    subjectName: 'Database Management Systems',
    subjectCode: 'CS502',
    examYear: 'November 2023',
    fileName: 'BSc_CS_DBMS_Nov2023.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    status: 'approved',
    isActive: true
  },
  {
    id: 'qp_com_fin_2024',
    department: 'B.Com General',
    subjectName: 'Financial Accounting',
    subjectCode: 'BC101',
    examYear: 'November 2024',
    fileName: 'BCom_FinancialAccounting_Nov2024.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    status: 'approved',
    isActive: true
  }
];

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initSyllabusPortal();
});

async function initSyllabusPortal() {
  await Promise.all([
    loadSyllabuses(),
    loadApprovedQuestionPapers()
  ]);
}

/**
 * Tab Switching: 📚 Download Syllabus vs 📝 Previous Year Question Papers
 */
function switchResourceTab(tabName) {
  currentActiveTab = tabName;

  const btnSyllabus = document.getElementById('tab-btn-syllabus');
  const btnQp = document.getElementById('tab-btn-qp');
  const contentSyllabus = document.getElementById('syllabus-tab');
  const contentQp = document.getElementById('qp-tab');

  if (tabName === 'syllabus') {
    if (btnSyllabus) {
      btnSyllabus.classList.add('active');
      btnSyllabus.setAttribute('aria-selected', 'true');
    }
    if (btnQp) {
      btnQp.classList.remove('active');
      btnQp.setAttribute('aria-selected', 'false');
    }
    if (contentSyllabus) contentSyllabus.classList.add('active');
    if (contentQp) contentQp.classList.remove('active');
  } else {
    if (btnQp) {
      btnQp.classList.add('active');
      btnQp.setAttribute('aria-selected', 'true');
    }
    if (btnSyllabus) {
      btnSyllabus.classList.remove('active');
      btnSyllabus.setAttribute('aria-selected', 'false');
    }
    if (contentQp) contentQp.classList.add('active');
    if (contentSyllabus) contentSyllabus.classList.remove('active');
  }
}

// =========================================================================
// SECTION 1: DOWNLOAD SYLLABUS (Department-based Only)
// =========================================================================

async function loadSyllabuses() {
  if (!window.isFirebaseConfigured || !window.isFirebaseConfigured()) {
    allSyllabuses = [...DEFAULT_SYLLABUS_SEEDS];
    filteredSyllabuses = [...allSyllabuses];
    renderSyllabusGrid();
    return;
  }

  try {
    const snapshot = await db.collection('syllabuses').get();
    allSyllabuses = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.isActive !== false) {
        allSyllabuses.push({ id: doc.id, ...data });
      }
    });

    if (allSyllabuses.length === 0) {
      allSyllabuses = [...DEFAULT_SYLLABUS_SEEDS];
    }

    filteredSyllabuses = [...allSyllabuses];
    renderSyllabusGrid();

  } catch (error) {
    console.warn('Firestore syllabuses error (using fallback defaults):', error);
    allSyllabuses = [...DEFAULT_SYLLABUS_SEEDS];
    filteredSyllabuses = [...allSyllabuses];
    renderSyllabusGrid();
  }
}

function handleSyllabusSearch(query) {
  const q = (query || '').toLowerCase().trim();

  if (!q) {
    filteredSyllabuses = [...allSyllabuses];
  } else {
    filteredSyllabuses = allSyllabuses.filter(s => {
      const dept = (s.department || '').toLowerCase();
      const title = (s.syllabusTitle || '').toLowerCase();
      const desc = (s.description || '').toLowerCase();
      return dept.includes(q) || title.includes(q) || desc.includes(q);
    });
  }

  renderSyllabusGrid();
}

function renderSyllabusGrid() {
  const container = document.getElementById('syllabus-grid-container');
  const counter = document.getElementById('syllabus-counter-badge');
  if (!container) return;

  if (counter) {
    counter.textContent = `${filteredSyllabuses.length} Department${filteredSyllabuses.length === 1 ? '' : 's'}`;
  }

  if (filteredSyllabuses.length === 0) {
    container.innerHTML = `
      <div class="resource-empty-state" style="grid-column: 1 / -1;">
        <div class="resource-empty-icon">🔍</div>
        <h3 class="resource-empty-title">No Department Syllabus Found</h3>
        <p class="resource-empty-desc">No uploaded syllabus matched your search term. Try searching for a different department.</p>
        <button class="btn btn-outline btn-sm" onclick="clearSyllabusSearch()">Clear Search</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredSyllabuses.map(s => {
    const icon = getDeptIcon(s.department);
    const pdfUrl = escapeHTML(s.pdfUrl || '#');

    return `
      <div class="syllabus-card">
        <div class="syllabus-card-header">
          <div class="syllabus-dept-icon">${icon}</div>
          <div class="syllabus-card-title-wrap">
            <h3 class="syllabus-dept-name">${escapeHTML(s.department)}</h3>
            <span class="syllabus-complete-badge">Complete Syllabus (All Semesters)</span>
          </div>
        </div>

        <div class="syllabus-card-body">
          <p>${escapeHTML(s.description || s.syllabusTitle || 'Official university curriculum and regulation syllabus document.')}</p>
        </div>

        <div class="syllabus-meta-row">
          <div class="syllabus-meta-item">
            <span>📋</span> ${escapeHTML(s.regulation || 'CBCS Regulation')}
          </div>
          <div class="syllabus-meta-item">
            <span>📄</span> PDF ${s.fileSize ? `(${escapeHTML(s.fileSize)})` : ''}
          </div>
        </div>

        <a href="${pdfUrl}" 
           class="btn-download-syllabus" 
           target="_blank" 
           rel="noopener noreferrer" 
           download="${escapeHTML(s.department)}_Complete_Syllabus.pdf"
           onclick="handlePdfDownload(event, '${pdfUrl}', '${escapeHTML(s.department)}_Complete_Syllabus.pdf')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Complete Syllabus PDF</span>
        </a>
      </div>
    `;
  }).join('');
}

function clearSyllabusSearch() {
  const input = document.getElementById('syllabus-search-input');
  if (input) input.value = '';
  handleSyllabusSearch('');
}

// =========================================================================
// SECTION 2: PREVIOUS YEAR QUESTION PAPERS (Approved & Active Only)
// =========================================================================

async function loadApprovedQuestionPapers() {
  if (!window.isFirebaseConfigured || !window.isFirebaseConfigured()) {
    approvedQuestionPapers = [...DEFAULT_APPROVED_QP_SEEDS];
    applyQpFiltersAndRender();
    return;
  }

  try {
    // Query ONLY approved & active question papers
    const snapshot = await db.collection('questionPapers')
      .where('status', '==', 'approved')
      .where('isActive', '==', true)
      .get();

    approvedQuestionPapers = [];

    snapshot.forEach(doc => {
      approvedQuestionPapers.push({ id: doc.id, ...doc.data() });
    });

    if (approvedQuestionPapers.length === 0) {
      // If Firestore contains no approved papers yet, load defaults for initial viewing
      approvedQuestionPapers = [...DEFAULT_APPROVED_QP_SEEDS];
    }

    applyQpFiltersAndRender();

  } catch (error) {
    console.warn('Firestore question papers fetch error (using fallback defaults):', error);
    approvedQuestionPapers = [...DEFAULT_APPROVED_QP_SEEDS];
    applyQpFiltersAndRender();
  }
}

/**
 * Dynamic Department Extraction:
 * Strictly extracts ONLY departments that contain APPROVED & ACTIVE question papers.
 */
function renderDynamicQpDepartmentFilters() {
  const container = document.getElementById('qp-dept-pills-container');
  if (!container) return;

  const deptMap = new Map();
  approvedQuestionPapers.forEach(p => {
    const d = (p.department || '').trim();
    if (d) {
      deptMap.set(d, (deptMap.get(d) || 0) + 1);
    }
  });

  const uniqueDepartments = Array.from(deptMap.keys()).sort();

  let html = `
    <button class="dept-pill ${selectedQpDepartment === 'All' ? 'active' : ''}" onclick="selectQpDepartment('All')">
      <span>All Departments</span>
      <span class="dept-pill-count">${approvedQuestionPapers.length}</span>
    </button>
  `;

  uniqueDepartments.forEach(dept => {
    const count = deptMap.get(dept);
    const icon = getDeptIcon(dept);
    html += `
      <button class="dept-pill ${selectedQpDepartment === dept ? 'active' : ''}" onclick="selectQpDepartment('${escapeHTML(dept)}')">
        <span>${icon} ${escapeHTML(dept)}</span>
        <span class="dept-pill-count">${count}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectQpDepartment(deptName) {
  selectedQpDepartment = deptName;
  applyQpFiltersAndRender();
}

function handleQpSearch(query) {
  applyQpFiltersAndRender(query);
}

function applyQpFiltersAndRender(searchQuery) {
  renderDynamicQpDepartmentFilters();

  const searchInput = document.getElementById('qp-search-input');
  const q = (searchQuery !== undefined ? searchQuery : (searchInput ? searchInput.value : '')).toLowerCase().trim();

  filteredQuestionPapers = approvedQuestionPapers.filter(paper => {
    // 1. Department Filter
    const matchDept = (selectedQpDepartment === 'All') || (paper.department === selectedQpDepartment);
    if (!matchDept) return false;

    // 2. Search Filter
    if (!q) return true;
    const sub = (paper.subjectName || '').toLowerCase();
    const code = (paper.subjectCode || '').toLowerCase();
    const year = String(paper.examYear || '').toLowerCase();
    const file = (paper.fileName || '').toLowerCase();

    return sub.includes(q) || code.includes(q) || year.includes(q) || file.includes(q);
  });

  renderQpGrid();
}

function renderQpGrid() {
  const container = document.getElementById('qp-grid-container');
  const counter = document.getElementById('qp-counter-badge');
  if (!container) return;

  if (counter) {
    counter.textContent = `${filteredQuestionPapers.length} Question Paper${filteredQuestionPapers.length === 1 ? '' : 's'}`;
  }

  if (filteredQuestionPapers.length === 0) {
    container.innerHTML = `
      <div class="resource-empty-state" style="grid-column: 1 / -1;">
        <div class="resource-empty-icon">📝</div>
        <h3 class="resource-empty-title">No Approved Question Papers</h3>
        <p class="resource-empty-desc">
          ${selectedQpDepartment !== 'All' 
            ? `No approved question papers are currently published for <strong>${escapeHTML(selectedQpDepartment)}</strong>.` 
            : `No approved question papers matched your search criteria.`}
        </p>
        <button class="btn btn-outline btn-sm" onclick="selectQpDepartment('All')">View All Approved Papers</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredQuestionPapers.map(p => {
    const fileUrl = escapeHTML(p.fileUrl || '#');
    const fileName = escapeHTML(p.fileName || `${p.subjectName || 'Question_Paper'}_${p.examYear || 'Exam'}.pdf`);

    return `
      <div class="qp-card">
        <div class="qp-header">
          <h4 class="qp-subject-title">${escapeHTML(p.subjectName)}</h4>
          <span class="qp-year-badge">${escapeHTML(p.examYear || 'University Exam')}</span>
        </div>

        <div class="qp-meta-info">
          <span class="qp-dept-tag">${escapeHTML(p.department)}</span>
          ${p.subjectCode ? `<span style="font-family:monospace; font-weight:700;">Code: ${escapeHTML(p.subjectCode)}</span>` : ''}
        </div>

        <div style="font-size:0.75rem; color:var(--text-light); word-break:break-all;">
          📄 ${fileName}
        </div>

        <div class="qp-actions">
          <a href="${fileUrl}" 
             class="btn-download-qp" 
             target="_blank" 
             rel="noopener noreferrer" 
             download="${fileName}"
             onclick="handlePdfDownload(event, '${fileUrl}', '${fileName}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download Paper (PDF)</span>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// =========================================================================
// PDF DOWNLOAD / ANDROID COMPATIBILITY HANDLER
// =========================================================================

function handlePdfDownload(e, url, fileName) {
  if (!url || url === '#' || url.startsWith('javascript:')) {
    e.preventDefault();
    showToast("PDF download link is not available.", "warning");
    return;
  }

  try {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.open(url, '_blank');
    }
  } catch (err) {
    console.warn("Download handler notice:", err);
  }
}

// =========================================================================
// USER QUESTION PAPER SUBMISSION (Subject to Admin Review)
// =========================================================================

function openQuestionPaperSubmitModal() {
  if (!auth.currentUser) {
    showToast("Please sign in with Google to submit question papers.", "info");
    if (typeof loginWithGoogle === 'function') loginWithGoogle();
    return;
  }
  openModal('qp-submit-modal');
}

async function handleQuestionPaperSubmit(e) {
  e.preventDefault();

  if (!auth.currentUser) {
    showToast("Please sign in with Google first.", "warning");
    return;
  }

  const dept = document.getElementById('submit-dept').value.trim();
  const subjectName = document.getElementById('submit-subject-name').value.trim();
  const examYear = document.getElementById('submit-exam-year').value.trim();
  const subjectCode = document.getElementById('submit-subject-code').value.trim();
  const pdfUrl = document.getElementById('submit-pdf-url').value.trim();
  const notes = document.getElementById('submit-notes').value.trim();
  const submitBtn = document.getElementById('submit-qp-btn');

  if (!dept || !subjectName || !examYear || !pdfUrl) {
    showToast("Please fill in all required fields.", "warning");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Submitting...`;
  }

  try {
    const fileName = `${dept}_${subjectName}_${examYear}.pdf`.replace(/\s+/g, '_');

    // Save with status: "pending" and isActive: false (requires admin approval)
    const payload = {
      department: dept,
      subjectName: subjectName,
      subjectCode: subjectCode || '',
      examYear: examYear,
      fileName: fileName,
      fileUrl: pdfUrl,
      notes: notes || '',
      status: 'pending',
      isActive: false,
      uploadedBy: auth.currentUser.uid,
      uploadedByName: auth.currentUser.displayName || 'University Member',
      uploaderEmail: auth.currentUser.email || '',
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: ''
    };

    await db.collection('questionPapers').add(payload);

    // Explicit confirmation message as required
    showToast("Your question paper has been submitted for admin review.", "success");
    closeModal('qp-submit-modal');
    document.getElementById('qp-submit-form').reset();

  } catch (error) {
    console.error("Submission failed:", error);
    showToast("Submission failed: " + error.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Submit for Admin Review</span>`;
    }
  }
}

// Window bindings
window.switchResourceTab = switchResourceTab;
window.handleSyllabusSearch = handleSyllabusSearch;
window.handleQpSearch = handleQpSearch;
window.selectQpDepartment = selectQpDepartment;
window.clearSyllabusSearch = clearSyllabusSearch;
window.openQuestionPaperSubmitModal = openQuestionPaperSubmitModal;
window.handleQuestionPaperSubmit = handleQuestionPaperSubmit;
window.handlePdfDownload = handlePdfDownload;
