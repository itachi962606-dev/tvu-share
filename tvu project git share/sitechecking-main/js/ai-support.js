/**
 * TVU Books & Materials - NOVA AI Support Controller
 * Handles chat communication with the secure AI backend, Markdown rendering,
 * rich book/order mini-cards, and instant COD checkout modal integration.
 */

// Configuration: Relative API Endpoint for Vercel Serverless Function
const API_ENDPOINT = '/api/chat';

let conversationHistory = [];
let isAwaitingResponse = false;
let lastFailedMessage = null;
let selectedBookForOrder = null;

const WELCOME_MESSAGE = `Hi! I'm NOVA, your TVU Books & Materials AI Assistant. How can I help you today?

I can help you with:
* 🔍 **Finding academic books** by title, subject, or department
* 💰 **Book prices, discounts & stock availability**
* 🛒 **How to buy books** with Cash on Delivery (COD) on campus
* 📦 **Checking your order status**
* 💖 **Viewing your saved wishlist**
* 💼 **Seller Portal help** (listing books, updating stock, managing orders)

Feel free to ask me in **English**, **தமிழ்**, or **Tanglish**!`;

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
  initChatUI();
  setupOrderCheckoutForm();
});

// Sync Auth State
window.addEventListener('authStateChanged', (e) => {
  const user = e.detail.user;
  updateAuthStatusUI(user);
});

function updateAuthStatusUI(user) {
  const dot = document.getElementById('auth-status-dot');
  const text = document.getElementById('auth-status-text');
  if (!dot || !text) return;

  if (user) {
    dot.style.backgroundColor = '#16a34a';
    text.textContent = user.displayName ? `Signed in as ${user.displayName.split(' ')[0]}` : 'Signed in';
    text.style.color = 'var(--text-muted)';
  } else {
    dot.style.backgroundColor = '#94a3b8';
    text.textContent = 'Guest Mode';
    text.style.color = 'var(--text-light)';
  }
}

function initChatUI() {
  const feed = document.getElementById('ai-messages-feed');
  const textarea = document.getElementById('ai-user-input');

  // Load from session storage or show welcome
  const saved = sessionStorage.getItem('tvu_nova_chat_history');
  if (saved) {
    try {
      conversationHistory = JSON.parse(saved);
      renderAllMessages();
    } catch (e) {
      conversationHistory = [];
      showWelcomeMessage();
    }
  } else {
    showWelcomeMessage();
  }

  // Textarea auto-resize & key bindings
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const form = document.getElementById('ai-chat-form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    textarea.focus();
  }
}

function showWelcomeMessage() {
  conversationHistory = [
    {
      role: 'assistant',
      content: WELCOME_MESSAGE,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];
  renderAllMessages();
}

function renderAllMessages() {
  const feed = document.getElementById('ai-messages-feed');
  if (!feed) return;

  feed.innerHTML = '';
  conversationHistory.forEach((msg, idx) => {
    feed.appendChild(createMessageElement(msg, idx));
  });

  scrollToBottom();
}

function createMessageElement(msg, index) {
  const row = document.createElement('div');
  row.className = `msg-row ${msg.role === 'user' ? 'user' : 'ai'}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  if (msg.role === 'user') {
    if (auth && auth.currentUser && auth.currentUser.photoURL) {
      avatar.innerHTML = `<img src="${auth.currentUser.photoURL}" alt="User" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      avatar.textContent = '👤';
    }
  } else {
    avatar.textContent = '🦢';
  }

  const content = document.createElement('div');
  content.className = 'msg-content';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (msg.role === 'assistant') {
    bubble.innerHTML = formatMarkdown(msg.content);

    // If message contains structured books or orders data
    if (msg.books && Array.isArray(msg.books) && msg.books.length > 0) {
      const booksGrid = renderMiniBooksGrid(msg.books);
      bubble.appendChild(booksGrid);
    }
    if (msg.orders && Array.isArray(msg.orders) && msg.orders.length > 0) {
      const ordersContainer = renderMiniOrdersList(msg.orders);
      bubble.appendChild(ordersContainer);
    }
  } else {
    bubble.textContent = msg.content;
  }

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  content.appendChild(bubble);
  content.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(content);

  return row;
}

function renderMiniBooksGrid(books) {
  const grid = document.createElement('div');
  grid.className = 'ai-books-grid';

  books.forEach(b => {
    const orig = Number(b.originalPrice) || 0;
    const disc = Number(b.discountedPrice) || orig;
    let discountPct = 0;
    if (orig > 0 && disc < orig) {
      discountPct = Math.round(((orig - disc) / orig) * 100);
    }

    const card = document.createElement('div');
    card.className = 'ai-book-card';
    card.innerHTML = `
      <div class="ai-book-header">
        <img src="${b.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&auto=format&fit=crop&q=80'}" 
             alt="${escapeHTML(b.title)}" 
             class="ai-book-thumb"
             onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&auto=format&fit=crop&q=80'">
        <div class="ai-book-info">
          <span class="ai-book-category">${escapeHTML(b.category || 'Academic')}</span>
          <h4 class="ai-book-title">${escapeHTML(b.title)}</h4>
          <span class="ai-book-author">By ${escapeHTML(b.author || 'TVU Member')}</span>
        </div>
      </div>
      <div class="ai-book-price-row">
        <span class="ai-book-price">₹${disc}</span>
        ${orig > disc ? `<span class="ai-book-orig-price">₹${orig}</span>` : ''}
        ${discountPct > 0 ? `<span class="ai-book-discount-tag">${discountPct}% OFF</span>` : ''}
      </div>
      <div class="ai-book-actions">
        <a href="book-details.html?id=${b.id || b.bookId}" class="ai-book-btn ai-book-btn-secondary" target="_blank">
          View
        </a>
        <button type="button" class="ai-book-btn ai-book-btn-primary" onclick="openChatBookOrderModal('${b.id || b.bookId}')">
          Buy COD
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  return grid;
}

function renderMiniOrdersList(orders) {
  const container = document.createElement('div');
  container.style.marginTop = '0.5rem';

  orders.forEach(o => {
    const card = document.createElement('div');
    card.className = 'ai-order-card';
    const statusClass = (o.orderStatus || '').toLowerCase() === 'delivered' ? 'delivered' : 'confirmed';
    
    card.innerHTML = `
      <div class="ai-order-header">
        <span class="ai-order-id">#${escapeHTML(o.orderId || o.id)}</span>
        <span class="ai-order-status ${statusClass}">${escapeHTML(o.orderStatus || 'Confirmed')}</span>
      </div>
      <div class="ai-order-details">
        <strong>${escapeHTML(o.bookTitle || 'Academic Book')}</strong> (Qty: ${o.quantity || 1})
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
        <span class="ai-order-total">Total: ₹${o.totalAmount || o.discountedPrice || 0}</span>
        <span style="font-size:0.75rem; color:var(--text-light);">${o.paymentMethod || 'Cash on Delivery'}</span>
      </div>
    `;
    container.appendChild(card);
  });

  return container;
}

// Quick Prompt Chip handler
function handleChipClick(promptText) {
  const textarea = document.getElementById('ai-user-input');
  if (textarea) {
    textarea.value = promptText;
    const form = document.getElementById('ai-chat-form');
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }
}

// Clear Chat History
function clearChatHistory() {
  sessionStorage.removeItem('tvu_nova_chat_history');
  showWelcomeMessage();
  showToast("Chat reset successfully", "info");
}

// Form Submit Handler
async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  if (isAwaitingResponse) return;

  const textarea = document.getElementById('ai-user-input');
  const sendBtn = document.getElementById('ai-send-button');
  if (!textarea) return;

  const userText = textarea.value.trim();
  if (!userText) return;

  // Add User Message
  const userMsg = {
    role: 'user',
    content: userText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  conversationHistory.push(userMsg);
  saveHistory();

  // Reset Input
  textarea.value = '';
  textarea.style.height = 'auto';
  textarea.focus();

  // Append user bubble to UI
  const feed = document.getElementById('ai-messages-feed');
  feed.appendChild(createMessageElement(userMsg, conversationHistory.length - 1));
  scrollToBottom();

  // Show Typing Indicator
  showTypingIndicator();
  isAwaitingResponse = true;
  if (sendBtn) sendBtn.disabled = true;

  try {
    // Get Firebase ID Token if user is authenticated
    let idToken = null;
    if (auth && auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch (tokErr) {
        console.warn("Could not retrieve auth token:", tokErr);
      }
    }

    // Prepare payload for secure AI backend
    const payload = {
      message: userText,
      history: conversationHistory.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      userInfo: auth && auth.currentUser ? {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName
      } : null
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    removeTypingIndicator();

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();

    const assistantMsg = {
      role: 'assistant',
      content: data.reply || "I'm sorry, I couldn't generate a response. Please try again.",
      books: data.books || null,
      orders: data.orders || null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    conversationHistory.push(assistantMsg);
    saveHistory();

    feed.appendChild(createMessageElement(assistantMsg, conversationHistory.length - 1));
    scrollToBottom();
    lastFailedMessage = null;

  } catch (error) {
    console.error("NOVA Chat Error:", error);
    removeTypingIndicator();
    showErrorMessage(error.message || "Failed to reach NOVA AI service.", userText);
  } finally {
    isAwaitingResponse = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function showTypingIndicator() {
  const feed = document.getElementById('ai-messages-feed');
  if (!feed) return;

  const typingRow = document.createElement('div');
  typingRow.className = 'msg-row ai';
  typingRow.id = 'ai-typing-indicator';
  typingRow.innerHTML = `
    <div class="msg-avatar">🦢</div>
    <div class="msg-content">
      <div class="msg-bubble ai-typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;

  feed.appendChild(typingRow);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('ai-typing-indicator');
  if (el) el.remove();
}

function showErrorMessage(errorText, failedQuery) {
  const feed = document.getElementById('ai-messages-feed');
  if (!feed) return;

  lastFailedMessage = failedQuery;

  const errorRow = document.createElement('div');
  errorRow.className = 'msg-row ai';
  errorRow.innerHTML = `
    <div class="msg-avatar">⚠️</div>
    <div class="msg-content">
      <div class="ai-error-banner">
        <div>
          <strong>Connection Error:</strong> ${escapeHTML(errorText)}
        </div>
        <button class="ai-error-retry" onclick="retryLastMessage()">Retry</button>
      </div>
    </div>
  `;

  feed.appendChild(errorRow);
  scrollToBottom();
}

function retryLastMessage() {
  if (lastFailedMessage) {
    const textarea = document.getElementById('ai-user-input');
    if (textarea) textarea.value = lastFailedMessage;
    // Remove the error banner
    const feed = document.getElementById('ai-messages-feed');
    if (feed && feed.lastElementChild) feed.lastElementChild.remove();
    handleChatSubmit();
  }
}

function saveHistory() {
  try {
    sessionStorage.setItem('tvu_nova_chat_history', JSON.stringify(conversationHistory.slice(-20)));
  } catch (e) {
    console.warn("Storage quota exceeded", e);
  }
}

function scrollToBottom() {
  const feed = document.getElementById('ai-messages-feed');
  if (feed) {
    feed.scrollTop = feed.scrollHeight;
  }
}

// Markdown Formatter Helper
function formatMarkdown(text) {
  if (!text) return '';

  let html = escapeHTML(text);

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic *text*
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  
  // Inline Code `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bullet items: lines starting with * or -
  const lines = html.split('\n');
  let inList = false;
  let result = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed.length > 0) {
        result.push(`<p>${line}</p>`);
      }
    }
  });

  if (inList) {
    result.push('</ul>');
  }

  return result.join('');
}

// Buy Modal from Chat
async function openChatBookOrderModal(bookId) {
  if (!window.isFirebaseConfigured()) {
    showToast("Firebase is not configured.", "warning");
    return;
  }

  try {
    showToast("Preparing order...", "info", 1000);
    const doc = await db.collection('books').doc(bookId).get();
    if (!doc.exists) {
      showToast("Book not found or unavailable.", "error");
      return;
    }

    selectedBookForOrder = { id: doc.id, ...doc.data() };

    const modalBookImg = document.getElementById('modal-book-img');
    const modalBookTitle = document.getElementById('modal-book-title');
    const modalBookSeller = document.getElementById('modal-book-seller');
    const modalBookPrice = document.getElementById('modal-book-price');
    const modalOrderTotal = document.getElementById('modal-order-total');
    const custNameInput = document.getElementById('order-cust-name');

    if (modalBookImg) modalBookImg.src = selectedBookForOrder.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&auto=format&fit=crop&q=80';
    if (modalBookTitle) modalBookTitle.textContent = selectedBookForOrder.title;
    if (modalBookSeller) modalBookSeller.textContent = `Seller: ${selectedBookForOrder.sellerName || 'TVU Seller'}`;
    
    const price = Number(selectedBookForOrder.discountedPrice) || Number(selectedBookForOrder.originalPrice) || 0;
    if (modalBookPrice) modalBookPrice.textContent = `₹${price}`;
    if (modalOrderTotal) modalOrderTotal.textContent = `₹${price}`;

    if (auth && auth.currentUser && custNameInput) {
      custNameInput.value = auth.currentUser.displayName || '';
    }

    openModal('buy-now-modal');
  } catch (err) {
    console.error("Order modal error:", err);
    showToast("Failed to open order form: " + err.message, "error");
  }
}

function setupOrderCheckoutForm() {
  const form = document.getElementById('order-checkout-form');
  const qtyInput = document.getElementById('order-qty');
  const modalTotal = document.getElementById('modal-order-total');

  if (qtyInput) {
    qtyInput.addEventListener('input', () => {
      if (!selectedBookForOrder) return;
      const qty = Math.max(1, parseInt(qtyInput.value) || 1);
      const unitPrice = Number(selectedBookForOrder.discountedPrice) || Number(selectedBookForOrder.originalPrice) || 0;
      if (modalTotal) modalTotal.textContent = `₹${unitPrice * qty}`;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!auth.currentUser) {
        showToast("Please sign in with Google to confirm your book order.", "warning");
        loginWithGoogle();
        return;
      }

      if (!selectedBookForOrder) return;

      const qty = Math.max(1, parseInt(document.getElementById('order-qty').value) || 1);
      const name = document.getElementById('order-cust-name').value.trim();
      const phone = document.getElementById('order-cust-phone').value.trim();
      const address = document.getElementById('order-cust-address').value.trim();
      const unitPrice = Number(selectedBookForOrder.discountedPrice) || Number(selectedBookForOrder.originalPrice) || 0;
      const total = unitPrice * qty;

      const orderId = 'TVU-' + Math.floor(100000 + Math.random() * 900000);
      const orderPayload = {
        orderId,
        customerId: auth.currentUser.uid,
        customerName: name,
        customerEmail: auth.currentUser.email || '',
        customerPhone: phone,
        customerAddress: address,
        sellerId: selectedBookForOrder.sellerId || '',
        sellerName: selectedBookForOrder.sellerName || 'TVU Seller',
        sellerEmail: selectedBookForOrder.sellerEmail || '',
        bookId: selectedBookForOrder.id,
        bookTitle: selectedBookForOrder.title,
        bookImageUrl: selectedBookForOrder.imageUrl || '',
        quantity: qty,
        unitPrice: unitPrice,
        totalAmount: total,
        paymentMethod: 'Cash on Delivery',
        orderStatus: 'Confirmed',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        showToast("Placing your Cash on Delivery order...", "info", 2000);
        await db.collection('orders').doc(orderId).set(orderPayload);

        // Update book stock
        try {
          const newStock = Math.max(0, (Number(selectedBookForOrder.stock) || 1) - qty);
          await db.collection('books').doc(selectedBookForOrder.id).update({
            stock: newStock,
            availability: newStock > 0 ? 'In Stock' : 'Out of Stock',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (stkErr) {
          console.warn("Stock update warning:", stkErr);
        }

        // Send EmailJS alert
        if (typeof sendSellerOrderEmail === 'function') {
          sendSellerOrderEmail({
            sellerEmail: orderPayload.sellerEmail,
            sellerName: orderPayload.sellerName,
            customerName: orderPayload.customerName,
            customerPhone: orderPayload.customerPhone,
            customerAddress: orderPayload.customerAddress,
            bookTitle: orderPayload.bookTitle,
            quantity: orderPayload.quantity,
            totalAmount: orderPayload.totalAmount,
            orderId: orderPayload.orderId
          }).catch(console.warn);
        }

        closeModal('buy-now-modal');
        document.getElementById('confirmed-order-id').textContent = '#' + orderId;
        openModal('order-confirmed-modal');
        triggerConfettiCelebration();

      } catch (err) {
        console.error("Order placement failed:", err);
        showToast("Order placement failed: " + err.message, "error");
      }
    });
  }
}

// Export to window
window.handleChatSubmit = handleChatSubmit;
window.handleChipClick = handleChipClick;
window.clearChatHistory = clearChatHistory;
window.retryLastMessage = retryLastMessage;
window.openChatBookOrderModal = openChatBookOrderModal;
