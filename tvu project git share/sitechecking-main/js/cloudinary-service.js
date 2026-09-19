/**
 * TVU Books & Materials - Cloudinary Direct Image Upload Service
 */

const CLOUDINARY_CONFIG = {
  cloudName: "cx5s0zn6",
  uploadPreset: "tvu_books_preset",
  folder: "tvu_books"
};

function isCloudinaryConfigured() {
  const name = (CLOUDINARY_CONFIG.cloudName || '').trim();
  const preset = (CLOUDINARY_CONFIG.uploadPreset || '').trim();
  return name.length > 0 && preset.length > 0;
}

function uploadImageToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error("Cloudinary setup missing. Verify credentials."));
    }

    if (!file) {
      return reject(new Error("No image file provided."));
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
    if (CLOUDINARY_CONFIG.folder) {
      formData.append("folder", CLOUDINARY_CONFIG.folder);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
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
          resolve(response.secure_url);
        } else {
          const detail = response.error ? response.error.message : `HTTP ${xhr.status}`;
          reject(new Error(`Upload failed: ${detail}`));
        }
      } catch (err) {
        reject(new Error("Response parse error: " + err.message));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during image upload."));
    xhr.send(formData);
  });
}

window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.isCloudinaryConfigured = isCloudinaryConfigured;
window.uploadImageToCloudinary = uploadImageToCloudinary;