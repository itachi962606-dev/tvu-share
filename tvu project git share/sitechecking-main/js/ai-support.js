/**
 * TVU Books & Materials - NOVA AI Support Controller
 * Handles chat communication with the secure AI backend, Markdown rendering,
 * rich book/order mini-cards, and instant COD checkout modal integration.
 */

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

document.addEventListener('DOMContentLoaded', () => {
  initChatUI();
  setupOrderCheckoutForm();
});

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
    if (window.auth && window.auth.currentUser && window.auth.currentUser.photoURL) {
      avatar.innerHTML = `<img src="${window.auth.currentUser.photoURL}" alt="User" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
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

    if (msg.books && Array.isArray(msg.books) && msg.books.length > 0) {
      bubble.appendChild(renderMiniBooksGrid(msg.books));
    }
    if (msg.orders && Array.isArray(msg.orders) && msg.orders.length > 0) {
      bubble.appendChild(renderMiniOrdersList(msg.orders));
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
        <span class="ai-book-price">₹${disc}</span>${orig > disc ? `<span class="ai-book-orig-price">₹${orig}</span>` : ''}
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
        <strong>${escapeHTML(o.bookTitle || 'Academic Book')}</strong> (Qty:${o.quantity || 1})
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

function handleChipClick(promptText) {
  const textarea = document.getElementById('ai-user-input');
  if (textarea) {
    textarea.value = promptText;
    const form = document.getElementById('ai-chat-form');
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }
}

function clearChatHistory() {
  sessionStorage.removeItem('tvu_nova_chat_history');
  showWelcomeMessage();
  if (typeof showToast === 'function') showToast("Chat reset successfully", "info");
}

async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  if (isAwaitingResponse) return;

  const textarea = document.getElementById('ai-user-input');
  const sendBtn = document.getElementById('ai-send-button');
  if (!textarea) return;

  const userText = textarea.value.trim();
  if (!userText) return;

  const userMsg = {
    role: 'user',
    content: userText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  conversationHistory.push(userMsg);
  saveHistory();

  textarea.value = '';
  textarea.style.height = 'auto';
  textarea.focus();

  const feed = document.getElementById('ai-messages-feed');
  feed.appendChild(createMessageElement(userMsg, conversationHistory.length - 1));
  scrollToBottom();

  showTypingIndicator();
  isAwaitingResponse = true;
  if (sendBtn) sendBtn.disabled = true;

  try {
    let idToken = null;
    if (window.auth && window.auth.currentUser) {
      try {
        idToken = await window.auth.currentUser.getIdToken();
      } catch (tokErr) {
        console.warn("Could not retrieve auth token:", tokErr);
      }
    }

    const payload = {
      message: userText,
      history: conversationHistory.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      userInfo: window.auth && window.auth.currentUser ? {
        uid: window.auth.currentUser.uid,
        email: window.auth.currentUser.email,
        displayName: window.auth.currentUser.displayName
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

// Markdown Formatter
function formatMarkdown(text) {
  if (!text) return '';

  let html = escapeHTML(text);

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic (corrected regex without syntax errors)
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  
  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

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

async function openChatBookOrderModal(bookId) {
  if (!window.isFirebaseConfigured || !window.isFirebaseConfigured()) {
    if (typeof showToast === 'function') showToast("Firebase is not configured.", "warning");
    return;
  }

  try {
    if (typeof showToast === 'function') showToast("Preparing order...", "info", 1000);
    const doc = await window.db.collection('books').doc(bookId).get();
    if (!doc.exists) {
      if (typeof showToast === 'function') showToast("Book not found or unavailable.", "error");
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

    if (window.auth && window.auth.currentUser && custNameInput) {
      custNameInput.value = window.auth.currentUser.displayName || '';
    }

    if (typeof openModal === 'function') openModal('buy-now-modal');
  } catch (err) {
    if (typeof showToast === 'function') showToast("Failed to open order form: " + err.message, "error");
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

      if (!window.auth || !window.auth.currentUser) {
        if (typeof showToast === 'function') showToast("Please sign in to confirm your book order.", "warning");
        if (typeof openGlobalAuthModal === 'function') openGlobalAuthModal('signup');
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
        customerId: window.auth.currentUser.uid,
        customerName: name,
        customerEmail: window.auth.currentUser.email || '',
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
        if (typeof showToast === 'function') showToast("Placing your Cash on Delivery order...", "info", 2000);
        await window.db.collection('orders').doc(orderId).set(orderPayload);

        try {
          const newStock = Math.max(0, (Number(selectedBookForOrder.stock) || 1) - qty);
          await window.db.collection('books').doc(selectedBookForOrder.id).update({
            stock: newStock,
            availability: newStock > 0 ? 'In Stock' : 'Out of Stock',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (stkErr) {
          console.warn("Stock update warning:", stkErr);
        }

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

        if (typeof closeModal === 'function') closeModal('buy-now-modal');
        const confEl = document.getElementById('confirmed-order-id');
        if (confEl) confEl.textContent = '#' + orderId;
        if (typeof openModal === 'function') openModal('order-confirmed-modal');
        if (typeof triggerConfettiCelebration === 'function') triggerConfettiCelebration();

      } catch (err) {
        if (typeof showToast === 'function') showToast("Order placement failed: " + err.message, "error");
      }
    });
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

window.handleChatSubmit = handleChatSubmit;
window.handleChipClick = handleChipClick;
window.clearChatHistory = clearChatHistory;
window.retryLastMessage = retryLastMessage;
window.openChatBookOrderModal = openChatBookOrderModal;