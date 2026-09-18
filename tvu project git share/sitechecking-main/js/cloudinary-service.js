/**
 * TVU Books & Materials - Cloudinary Image Upload Service
 * 
 * Uploads book cover images directly from the browser to Cloudinary
 * using an Unsigned Upload Preset. No Firebase Storage or server required.
 * 
 * Instructions:
 * 1. Log in to your free Cloudinary account (https://cloudinary.com).
 * 2. Find your "Cloud name" on the Cloudinary Dashboard.
 * 3. Go to Settings (gear icon) -> Upload -> Upload presets -> Add upload preset.
 * 4. Set "Signing Mode" to "Unsigned" and click Save.
 * 5. Replace YOUR_CLOUDINARY_CLOUD_NAME and YOUR_CLOUDINARY_UPLOAD_PRESET below.
 * 
 * IMPORTANT: NEVER put your Cloudinary API Secret in frontend code.
 */

const CLOUDINARY_CONFIG = {
  cloudName: "cx5s0zn6",       // e.g. "dxyz123ab"
  uploadPreset: "tvu_books_preset", // e.g. "tvu_books_preset" (must be Unsigned)
  folder: "tvu_books"                            // Optional folder in Cloudinary media library
};

/**
 * Check if Cloudinary is configured with valid credentials
 * @returns {boolean}
 */
function isCloudinaryConfigured() {
  const name = (CLOUDINARY_CONFIG.cloudName || '').trim();
  const preset = (CLOUDINARY_CONFIG.uploadPreset || '').trim();
  return name.length > 0 &&
         preset.length > 0 &&
         name !== "YOUR_CLOUDINARY_CLOUD_NAME" &&
         preset !== "YOUR_CLOUDINARY_UPLOAD_PRESET";
}

/**
 * Upload an image file directly to Cloudinary
 * @param {File} file - The image file selected by the seller
 * @param {Function} [onProgress] - Callback for upload percentage (0-100)
 * @returns {Promise<string>} - Resolves with the secure HTTPS image URL (secure_url)
 */
function uploadImageToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    // 1. Check configuration
    if (!isCloudinaryConfigured()) {
      const errorMsg = "Cloudinary is not configured yet. Please enter your Cloud Name and Unsigned Upload Preset in js/cloudinary-service.js.";
      return reject(new Error(errorMsg));
    }

    // 2. Validate file presence
    if (!file) {
      return reject(new Error("No image file provided for upload."));
    }

    // 3. Prepare FormData
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
    if (CLOUDINARY_CONFIG.folder) {
      formData.append("folder", CLOUDINARY_CONFIG.folder);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

    // 4. Perform XHR upload with progress tracking
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && response.secure_url) {
          // Success! Return the HTTPS URL
          resolve(response.secure_url);
        } else {
          const errorDetail = response.error ? response.error.message : `HTTP ${xhr.status}`;
          reject(new Error(`Cloudinary upload failed: ${errorDetail}`));
        }
      } catch (err) {
        reject(new Error("Failed to parse Cloudinary response: " + err.message));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error occurred while uploading image to Cloudinary. Please check your internet connection."));
    };

    xhr.send(formData);
  });
}

// Attach to window object for global access across scripts
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.isCloudinaryConfigured = isCloudinaryConfigured;
window.uploadImageToCloudinary = uploadImageToCloudinary;
