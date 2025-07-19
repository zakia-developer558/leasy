// Firebase Admin SDK setup for backend file uploads (invoices)
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create service account object from environment variables
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  clientId: process.env.FIREBASE_CLIENT_ID,
  authUri: process.env.FIREBASE_AUTH_URI,
  tokenUri: process.env.FIREBASE_TOKEN_URI,
  authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universeDomain: process.env.FIREBASE_UNIVERSE_DOMAIN
};

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'certusimages.appspot.com', // Your Firebase Storage bucket
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