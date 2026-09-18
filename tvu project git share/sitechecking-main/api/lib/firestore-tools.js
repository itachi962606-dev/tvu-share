/**
 * TVU Books & Materials - Firestore Tools & Data Controller for Vercel Serverless
 * Uses official Firebase Admin SDK verifyIdToken() for cryptographic server-side validation.
 * Strictly scopes private user queries to the verified UID.
 * Exposes approved academic resources (Syllabus & Question Papers) to public queries.
 */

import admin from 'firebase-admin';

let isFirebaseAdminInitialized = false;

/**
 * Initialize Firebase Admin SDK using Vercel Environment Variables
 */
function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'ecomerce-23100';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return admin.initializeApp({
        credential: admin.credential.cert(parsed),
        projectId: parsed.project_id || projectId
      });
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e.message);
    }
  }

  if (clientEmail && privateKey) {
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      }),
      projectId
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({ projectId });
  }

  return admin.initializeApp({ projectId });
}

function hasAdminCredentials() {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/**
 * Official Firebase Admin SDK ID Token Verification
 */
export async function verifyAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  if (!hasAdminCredentials()) {
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) return null;

  try {
    getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken, true);
    if (decodedToken && decodedToken.uid) {
      return {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || ''
      };
    }
  } catch (err) {
    console.warn('Firebase Admin verifyIdToken rejected token:', err.message);
  }

  return null;
}

/**
 * Get Firestore instance safely
 */
function getDb() {
  if (!hasAdminCredentials()) {
    return null;
  }
  getFirebaseAdmin();
  return admin.firestore();
}

/**
 * 1. Search Available Books (Customer / Public Discovery)
 */
export async function searchAvailableBooks({ query = '', category = 'All', maxPrice = null }) {
  try {
    const db = getDb();
    if (!db) {
      return {
        found: 0,
        books: [],
        message: "Search available via TVU Books catalog."
      };
    }
    let queryRef = db.collection('books');

    if (category && category !== 'All') {
      queryRef = queryRef.where('category', '==', category);
    }

    const snapshot = await queryRef.limit(40).get();
    let books = [];

    snapshot.forEach(doc => {
      const b = doc.data();
      books.push({
        id: doc.id,
        title: b.title || '',
        author: b.author || '',
        category: b.category || '',
        description: b.description || '',
        discountedPrice: Number(b.discountedPrice || b.originalPrice || 0),
        originalPrice: Number(b.originalPrice || 0),
        stock: Number(b.stock || 1),
        availability: b.availability || (b.stock > 0 ? 'In Stock' : 'Out of Stock'),
        sellerName: b.sellerName || 'TVU Seller',
        imageUrl: b.imageUrl || ''
      });
    });

    const qLower = (query || '').toLowerCase().trim();
    if (qLower) {
      const keywords = qLower.split(/\s+/).filter(k => k.length > 1);
      books = books.filter(b => {
        const t = (b.title || '').toLowerCase();
        const a = (b.author || '').toLowerCase();
        const c = (b.category || '').toLowerCase();
        const d = (b.description || '').toLowerCase();

        return keywords.some(k => t.includes(k) || a.includes(k) || c.includes(k) || d.includes(k));
      });
    }

    if (maxPrice && !isNaN(Number(maxPrice))) {
      books = books.filter(b => (b.discountedPrice || b.originalPrice) <= Number(maxPrice));
    }

    const results = books.slice(0, 6).map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category,
      discountedPrice: b.discountedPrice || b.originalPrice,
      originalPrice: b.originalPrice,
      stock: b.stock,
      availability: b.availability,
      sellerName: b.sellerName,
      imageUrl: b.imageUrl
    }));

    return {
      found: results.length,
      books: results,
      message: results.length === 0 ? "No matching academic books currently found in inventory." : `Found ${results.length} matching books.`
    };
  } catch (error) {
    console.error('searchAvailableBooks error:', error);
    return {
      found: 0,
      books: [],
      error: "Unable to search books: " + error.message
    };
  }
}

/**
 * 2. Get User Orders (Customer Private Data)
 */
export async function getUserOrders({ verifiedUid }) {
  if (!verifiedUid) {
    return {
      authenticated: false,
      orders: [],
      message: "Please sign in with your Google Account to view your order history."
    };
  }

  try {
    const db = getDb();
    if (!db) {
      return { authenticated: true, count: 0, orders: [], message: "Orders available in your Orders page." };
    }
    const snapshot = await db.collection('orders')
      .where('customerId', '==', verifiedUid)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const orders = [];
    snapshot.forEach(doc => {
      const o = doc.data();
      orders.push({
        orderId: o.orderId || doc.id,
        bookTitle: o.bookTitle || 'Academic Book',
        quantity: Number(o.quantity || 1),
        totalAmount: Number(o.totalAmount || 0),
        paymentMethod: o.paymentMethod || 'Cash on Delivery',
        orderStatus: o.orderStatus || 'Confirmed',
        date: o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString('en-IN') : 'Recent'
      });
    });

    return {
      authenticated: true,
      count: orders.length,
      orders: orders,
      message: orders.length === 0 ? "You haven't placed any book orders yet." : `You have ${orders.length} confirmed order(s).`
    };
  } catch (error) {
    console.error('getUserOrders error:', error);
    return {
      authenticated: true,
      orders: [],
      error: "Could not retrieve order history: " + error.message
    };
  }
}

/**
 * 3. Get User Wishlist (Customer Private Data)
 */
export async function getUserWishlist({ verifiedUid }) {
  if (!verifiedUid) {
    return {
      authenticated: false,
      wishlist: [],
      message: "Please sign in with your Google Account to view your saved wishlist."
    };
  }

  try {
    const db = getDb();
    if (!db) {
      return { authenticated: true, count: 0, wishlist: [], message: "Wishlist available in your Wishlist page." };
    }
    const snapshot = await db.collection('users').doc(verifiedUid).collection('wishlist').get();

    const items = [];
    snapshot.forEach(doc => {
      const item = doc.data();
      items.push({
        id: doc.id,
        title: item.title || '',
        author: item.author || 'TVU Faculty',
        category: item.category || 'General',
        price: Number(item.discountedPrice || item.originalPrice || 0)
      });
    });

    return {
      authenticated: true,
      count: items.length,
      wishlist: items,
      message: items.length === 0 ? "Your wishlist is currently empty." : `You have ${items.length} saved item(s) in your wishlist.`
    };
  } catch (error) {
    console.error('getUserWishlist error:', error);
    return {
      authenticated: true,
      wishlist: [],
      error: "Could not retrieve wishlist: " + error.message
    };
  }
}

/**
 * 4. Get Seller Listed Books (Seller Private Data)
 */
export async function getSellerBooks({ verifiedUid }) {
  if (!verifiedUid) {
    return {
      authenticated: false,
      books: [],
      message: "Please sign in to view your listed books in Seller Hub."
    };
  }

  try {
    const db = getDb();
    if (!db) {
      return { authenticated: true, count: 0, books: [], message: "Books available in Seller Hub." };
    }
    const snapshot = await db.collection('books')
      .where('sellerId', '==', verifiedUid)
      .orderBy('createdAt', 'desc')
      .get();

    const books = [];
    snapshot.forEach(doc => {
      const b = doc.data();
      books.push({
        id: doc.id,
        title: b.title || '',
        category: b.category || '',
        price: Number(b.discountedPrice || b.originalPrice || 0),
        stock: Number(b.stock || 0),
        availability: b.availability || (b.stock > 0 ? 'In Stock' : 'Out of Stock')
      });
    });

    return {
      authenticated: true,
      count: books.length,
      books: books,
      message: books.length === 0 ? "You haven't listed any books for sale yet." : `You have ${books.length} listed book(s).`
    };
  } catch (error) {
    console.error('getSellerBooks error:', error);
    return {
      authenticated: true,
      books: [],
      error: "Could not retrieve seller books: " + error.message
    };
  }
}

/**
 * 5. Get Seller Incoming Orders (Seller Private Data)
 */
export async function getSellerOrders({ verifiedUid }) {
  if (!verifiedUid) {
    return {
      authenticated: false,
      orders: [],
      message: "Please sign in to view customer orders for your listed books."
    };
  }

  try {
    const db = getDb();
    if (!db) {
      return { authenticated: true, count: 0, orders: [], message: "Orders available in Seller Hub." };
    }
    const snapshot = await db.collection('orders')
      .where('sellerId', '==', verifiedUid)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = [];
    snapshot.forEach(doc => {
      const o = doc.data();
      orders.push({
        orderId: o.orderId || doc.id,
        bookTitle: o.bookTitle || 'Academic Book',
        customerName: o.customerName || 'TVU Student',
        customerPhone: o.customerPhone || 'N/A',
        address: o.customerAddress || 'Campus Handover',
        quantity: Number(o.quantity || 1),
        totalAmount: Number(o.totalAmount || 0),
        orderStatus: o.orderStatus || 'Confirmed'
      });
    });

    return {
      authenticated: true,
      count: orders.length,
      orders: orders,
      message: orders.length === 0 ? "No incoming purchase orders for your books yet." : `You have ${orders.length} incoming order(s).`
    };
  } catch (error) {
    console.error('getSellerOrders error:', error);
    return {
      authenticated: true,
      orders: [],
      error: "Could not retrieve seller orders: " + error.message
    };
  }
}

/**
 * 6. Search Academic Syllabus (Public Approved Resources)
 */
export async function searchAcademicSyllabus({ department = '' }) {
  try {
    const db = getDb();
    if (!db) {
      return {
        found: 0,
        syllabuses: [],
        pageUrl: '/download-syllabus.html'
      };
    }
    const snapshot = await db.collection('syllabuses').where('isActive', '==', true).get();
    let syllabuses = [];

    snapshot.forEach(doc => {
      const s = doc.data();
      syllabuses.push({
        id: doc.id,
        department: s.department || '',
        syllabusTitle: s.syllabusTitle || 'Complete Regulation Syllabus',
        regulation: s.regulation || 'CBCS Regulation',
        pdfUrl: s.pdfUrl || ''
      });
    });

    const dLower = (department || '').toLowerCase().trim();
    if (dLower) {
      syllabuses = syllabuses.filter(s => s.department.toLowerCase().includes(dLower) || s.syllabusTitle.toLowerCase().includes(dLower));
    }

    return {
      found: syllabuses.length,
      syllabuses: syllabuses.slice(0, 5),
      pageUrl: '/download-syllabus.html'
    };
  } catch (error) {
    console.error('searchAcademicSyllabus error:', error);
    return { found: 0, syllabuses: [], pageUrl: '/download-syllabus.html' };
  }
}

/**
 * 7. Search Approved Question Papers (Public Approved Only)
 */
export async function searchApprovedQuestionPapers({ department = '', subject = '' }) {
  try {
    const db = getDb();
    if (!db) {
      return {
        found: 0,
        questionPapers: [],
        pageUrl: '/download-syllabus.html'
      };
    }
    const snapshot = await db.collection('questionPapers')
      .where('status', '==', 'approved')
      .where('isActive', '==', true)
      .get();

    let papers = [];
    snapshot.forEach(doc => {
      const p = doc.data();
      papers.push({
        id: doc.id,
        department: p.department || '',
        subjectName: p.subjectName || '',
        subjectCode: p.subjectCode || '',
        examYear: p.examYear || '',
        fileUrl: p.fileUrl || ''
      });
    });

    if (department) {
      papers = papers.filter(p => p.department.toLowerCase().includes(department.toLowerCase()));
    }
    if (subject) {
      papers = papers.filter(p => p.subjectName.toLowerCase().includes(subject.toLowerCase()) || (p.subjectCode && p.subjectCode.toLowerCase().includes(subject.toLowerCase())));
    }

    return {
      found: papers.length,
      questionPapers: papers.slice(0, 5),
      pageUrl: '/download-syllabus.html'
    };
  } catch (error) {
    console.error('searchApprovedQuestionPapers error:', error);
    return { found: 0, questionPapers: [], pageUrl: '/download-syllabus.html' };
  }
}

/**
 * 8. Platform FAQ & Help Guides
 */
export function getPlatformFaq({ topic = 'general' }) {
  const t = (topic || '').toLowerCase();
  
  if (t.includes('syllabus') || t.includes('curriculum') || t.includes('regulation')) {
    return {
      topic: "Download Syllabus",
      guidelines: [
        "1. Go to '📥 Download Syllabus' in the top navigation.",
        "2. Choose or search for your academic department (e.g. B.Sc Computer Science, B.Com).",
        "3. Download the complete regulation syllabus PDF covering all semesters.",
        "4. Direct link: download-syllabus.html"
      ]
    };
  }

  if (t.includes('question') || t.includes('exam paper') || t.includes('previous year') || t.includes('pyq')) {
    return {
      topic: "Previous Year Question Papers",
      guidelines: [
        "1. Visit the '📥 Download Syllabus' page.",
        "2. Click the '📝 Previous Year Question Papers' tab.",
        "3. Select your department from the dynamic department list to view only approved question papers.",
        "4. Click 'Download Paper (PDF)' to download official semester exam question papers.",
        "5. Students can also submit question papers for admin review using the 'Submit Question Paper' button."
      ]
    };
  }

  if (t.includes('buy') || t.includes('payment') || t.includes('cod') || t.includes('purchase')) {
    return {
      topic: "Cash on Delivery Buying Process",
      guidelines: [
        "1. Find textbooks on TVU Books & Materials.",
        "2. Click 'Buy Now' or 'Confirm Order (COD)'.",
        "3. Provide your name, contact phone/WhatsApp number, and campus handover location (hostel, department block).",
        "4. Pay cash directly to the student seller when you receive the book on campus.",
        "5. An automated email is sent to the seller with your details."
      ]
    };
  }

  if (t.includes('sell') || t.includes('list') || t.includes('seller') || t.includes('stock')) {
    return {
      topic: "Selling Academic Books",
      guidelines: [
        "1. Click 'Sell Your Books' in the top navigation.",
        "2. Complete one-time seller onboarding (Department, Phone).",
        "3. Go to 'My Listed Books' and click '+ Add New Book'.",
        "4. Upload the textbook photo, set MRP & discount price, and submit.",
        "5. Check 'Seller Orders' to see student buyer contact numbers for campus delivery."
      ]
    };
  }

  return {
    topic: "About TVU Books & Materials",
    description: "Thiruvalluvar University student textbook exchange and academic resource marketplace."
  };
}
