# TVU Books & Materials 📚

> **Thiruvalluvar University Academic Textbook & Study Material Marketplace**  
> A lightweight, clean, responsive, and fully functional university-level book buying and selling web application built with **HTML5, Vanilla CSS, Vanilla JavaScript, Firebase (Auth, Firestore, Storage), and EmailJS**.

---

## 🏛️ Features Overview

- **Official University Branding**: Features the official Thiruvalluvar University emblem and academic color styling.
- **Google Sign-In**: One-click Google authentication with automatic customer profile creation in `customers/{uid}`.
- **Seller Hub**: Separate seller onboarding (`sellers/{uid}`) without destroying customer status.
- **Dynamic Book Inventory**:
  - Direct image upload from browser to **Firebase Storage** (`book-images/{sellerId}/{bookId}/`).
  - Automatic discount percentage computation (`((MRP - Discounted) / MRP) * 100`).
  - Edit pricing, stock availability, notes, or replace cover image dynamically.
- **Student Discovery**:
  - Live search by title, author, or department category.
  - Department filtering (Engineering, Computer Science, Mathematics, Science, Commerce, Arts, Study Materials, etc.).
  - Sort by Price (Low to High, High to Low) or Newest.
- **Personalized Wishlist**: Private saved items in `users/{uid}/wishlist/{bookId}`.
- **Cash on Delivery (COD) Checkout**: Instant order creation in `orders/{orderId}` with campus handover details.
- **Interactive Celebration**: Lightweight canvas confetti celebration + pop checkmark modal upon successful order creation.
- **Automated Seller Email Alerts**: EmailJS seller dispatch with buyer contact and delivery address.
- **Subtle Home Page Butterfly Animation**: Elegant, non-intrusive CSS/JS butterfly that gracefully flutters and perches on UI elements (respects `prefers-reduced-motion`).

---

## 📂 Project Structure

```
d:/anti tvu project/
├── index.html              # Home page with hero, dynamic catalog & butterfly
├── books.html              # Full catalog with search, filter & sorting
├── book-details.html       # Single book view with seller info & buy modal
├── wishlist.html           # Saved items page
├── orders.html             # Customer order history
├── seller.html             # Seller registration & onboarding
├── seller-books.html       # Seller book inventory & Add/Edit modal
├── seller-orders.html      # Seller incoming orders & COD collection
│
├── css/
│   ├── style.css           # Core academic design tokens, components & modals
│   └── responsive.css      # Mobile drawer and adaptive breakpoints
│
├── js/
│   ├── firebase-config.js  # Centralized Firebase initialization & keys
│   ├── auth.js             # Google auth state & dynamic header
│   ├── email-service.js    # EmailJS order dispatch service
│   ├── notifications.js    # Toasts, modals, formatters & canvas confetti
│   ├── butterfly.js        # Smooth Home page animated butterfly
│   ├── home.js             # Home page catalog controller
│   ├── books.js            # Catalog filter & search controller
│   ├── book-details.js     # Single book view controller
│   ├── wishlist.js         # Customer wishlist controller
│   ├── orders.js           # Customer orders controller
│   ├── seller.js           # Seller onboarding controller
│   ├── seller-books.js     # Seller inventory & Firebase Storage upload
│   └── seller-orders.js    # Seller incoming orders controller
│
├── assets/
│   └── tvu-logo.png        # Official Thiruvalluvar University Crest
│
├── firestore.rules         # Security rules for Cloud Firestore
├── storage.rules           # Security rules for Firebase Storage
└── README.md               # Complete setup and deployment guide
```

---

## 🚀 Setup & Configuration Guide

### 1. Firebase Project Creation
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, name it `tvu-books-materials` (or your preferred name), and complete setup.

### 2. Google Authentication Setup
1. In the Firebase Console left menu, navigate to **Build > Authentication**.
2. Click **Get Started**, select **Sign-in method**, and choose **Google**.
3. Enable Google provider, select your project support email, and click **Save**.
4. In the **Authorized domains** tab, add your localhost and your Vercel deployment domain (e.g., `tvu-books.vercel.app`).

### 3. Cloud Firestore Setup
1. In Firebase Console, navigate to **Build > Firestore Database**.
2. Click **Create database**, select a region close to your users (e.g., `asia-south1` / Mumbai), and start in **Production mode**.
3. Go to the **Rules** tab and paste the contents of `firestore.rules`.
4. Click **Publish**.

#### Firestore Collections Schema:
- **`customers/{uid}`**:
  - `uid` (string)
  - `name` (string)
  - `email` (string)
  - `profileImage` (string URL)
  - `role`: `"customer"`
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)
- **`sellers/{uid}`**:
  - `uid` (string)
  - `name` (string)
  - `email` (string)
  - `phone` (string)
  - `university` (string)
  - `department` (string)
  - `description` (string)
  - `profileImage` (string URL)
  - `role`: `"seller"`
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)
- **`books/{bookId}`**:
  - `bookId` (string)
  - `title` (string)
  - `author` (string)
  - `category` (string)
  - `description` (string)
  - `notes` (string)
  - `sellerId` (string)
  - `sellerName` (string)
  - `sellerEmail` (string)
  - `originalPrice` (number)
  - `discountedPrice` (number)
  - `discountPercentage` (number)
  - `imageUrl` (Cloudinary CDN secure HTTPS URL)
  - `stock` (number)
  - `availability` (`"In Stock"` | `"Out of Stock"`)
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)
- **`users/{uid}/wishlist/{bookId}`**:
  - `bookId`, `title`, `author`, `category`, `discountedPrice`, `originalPrice`, `imageUrl`, `sellerName`, `addedAt`
- **`orders/{orderId}`**:
  - `orderId` (string, e.g. `TVU-XXXXX`)
  - `customerId`, `customerName`, `customerEmail`, `customerPhone`, `customerAddress`
  - `sellerId`, `sellerName`, `sellerEmail`
  - `bookId`, `bookTitle`, `bookImageUrl`, `quantity`, `originalPrice`, `discountedPrice`, `totalAmount`
  - `paymentMethod`: `"Cash on Delivery"`
  - `orderStatus`: `"Confirmed"` | `"Delivered"`
  - `createdAt` (timestamp), `updatedAt` (timestamp)

### 4. Cloudinary Setup (Free Image Storage & CDN)
1. Sign up for a free account at [Cloudinary.com](https://cloudinary.com/).
2. On your **Cloudinary Dashboard**, locate and copy your **Cloud name** (e.g. `dxyz123ab`).
3. Click the **Settings (gear icon)** in the top right / bottom left.
4. Navigate to **Upload** (or **Upload Presets**).
5. Scroll down to **Upload presets** and click **Add upload preset**.
6. Set:
   - **Upload preset name**: e.g. `tvu_books_preset` (or keep the generated name).
   - **Signing Mode**: Select **Unsigned** (crucial for client-side uploads).
   - **Folder**: `tvu_books` (optional).
7. Click **Save**.
8. Open `js/cloudinary-service.js` and paste your Cloud Name and Upload Preset:
   ```javascript
   const CLOUDINARY_CONFIG = {
     cloudName: "your_cloud_name",
     uploadPreset: "your_unsigned_upload_preset",
     folder: "tvu_books"
   };
   ```
*(Note: Never place your Cloudinary API Secret in frontend code.)*

### 5. EmailJS Setup (Seller Order Notifications)
1. Sign up at [EmailJS.com](https://www.emailjs.com/).
2. Create an **Email Service** (e.g. Gmail). Note down your `Service ID`.
3. Create an **Email Template** with subject `New Book Order - TVU Books & Materials` and parameters:
   - `{{to_name}}`, `{{to_email}}`, `{{order_id}}`, `{{customer_name}}`, `{{customer_phone}}`, `{{delivery_address}}`, `{{book_title}}`, `{{quantity}}`, `{{total_amount}}`, `{{payment_method}}`, `{{order_date}}`.
4. Copy your `Template ID` and `Public Key` (Account > API Keys).
5. Open `js/email-service.js` and fill in:
   ```javascript
   const EMAILJS_CONFIG = {
     serviceId: "your_service_id",
     templateId: "your_template_id",
     publicKey: "your_public_key"
   };
   ```

### 6. Connect Firebase Config in Code
Open `js/firebase-config.js` and paste your web app credentials:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tvu-books-materials.firebaseapp.com",
  projectId: "tvu-books-materials",
  storageBucket: "tvu-books-materials.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

---

## 💻 Local Testing Instructions

Because Firebase Authentication and modern web scripts require HTTP/HTTPS origin (not `file:///`), run a simple local web server:

### Option A: VS Code Live Server
Right-click `index.html` and select **Open with Live Server** (runs at `http://127.0.0.1:5500`).

### Option B: Python HTTP Server
Run in the project directory:
```bash
python -m http.server 8000
```
Open `http://localhost:8000` in your browser.

### Option C: Node `npx serve`
```bash
npx serve .
```

---

## 🌐 GitHub & Vercel Deployment Instructions

### 1. Push to GitHub
Initialize your git repository and push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit: TVU Books & Materials"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tvu-books-materials.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [Vercel](https://vercel.com/) and click **Add New > Project**.
2. Import your `tvu-books-materials` GitHub repository.
3. Keep default settings (Framework Preset: **Other**, Root Directory: `./`).
4. Click **Deploy**.
5. Once deployed, copy your production domain (e.g. `tvu-books-materials.vercel.app`).
6. **Important**: Go to Firebase Console > Authentication > Settings > **Authorized Domains**, and add `tvu-books-materials.vercel.app`.

---

## 📋 Final Verification Checklist

| Item | Requirement | Status |
| :--- | :--- | :---: |
| 1 | Official TVU logo in header | ✅ |
| 2 | Google Sign-in & separate `customers/{uid}` profile | ✅ |
| 3 | Seller registration & separate `sellers/{uid}` profile | ✅ |
| 4 | Image upload directly to Firebase Storage (`book-images/`) | ✅ |
| 5 | Image URL saved in Firestore (`books/{bookId}`) | ✅ |
| 6 | Real-time discount calculation (`30% OFF`) | ✅ |
| 7 | Live catalog fetching & category chips | ✅ |
| 8 | Search by title, author, and category | ✅ |
| 9 | Single Book Details view with study notes | ✅ |
| 10 | Customer Wishlist (`users/{uid}/wishlist`) | ✅ |
| 11 | Cash on Delivery (COD) only payment mode | ✅ |
| 12 | Confetti celebration & checkmark pop upon order success | ✅ |
| 13 | EmailJS seller notification on new order | ✅ |
| 14 | Customer "My Orders" view | ✅ |
| 15 | Seller "My Listed Books" (Add, Edit, Replace Image, Delete) | ✅ |
| 16 | Seller "Incoming Orders" view | ✅ |
| 17 | Floating animated butterfly with gentle perching & reduced-motion check | ✅ |
| 18 | Secure Firestore & Storage security rules | ✅ |
| 19 | Mobile, Tablet & Desktop responsive layout | ✅ |
| 20 | Zero code edits or redeployments required for new book uploads | ✅ |

---

© 2026 TVU Books & Materials • Thiruvalluvar University
#   s i t e c h e c k i n g  
 