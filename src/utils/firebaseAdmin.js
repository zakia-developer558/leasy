// Firebase Admin SDK setup for backend file uploads (invoices)
const admin = require('firebase-admin');
const path = require('path');

// Path to your Firebase service account key JSON file
// Download this from Firebase Console > Project Settings > Service Accounts
const serviceAccount = require(path.join(__dirname, '../../firebase-service-account.json'));

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'certusimages.appspot.com', // Your Firebase Storage bucket
  });
}

const bucket = admin.storage().bucket();

/**
 * Uploads a buffer to Firebase Storage and returns the public URL.
 * @param {Buffer} buffer - The PDF buffer to upload.
 * @param {string} filename - The destination filename in the bucket (e.g., 'invoices/invoice_123.pdf').
 * @returns {Promise<string>} - The public URL of the uploaded file.
 */
async function uploadInvoiceToFirebase(buffer, filename) {
  const file = bucket.file(filename);
  await file.save(buffer, {
    metadata: { contentType: 'application/pdf' },
    public: true, // Make the file public (optional, or use signed URLs for security)
    validation: 'md5'
  });
  // Make the file public (if not already)
  await file.makePublic();
  return file.publicUrl();
}

module.exports = { admin, bucket, uploadInvoiceToFirebase }; 