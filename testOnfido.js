require('dotenv').config();
const axios = require('axios');

// Configuration
const ONFIDO_API_TOKEN = process.env.ONFIDO_API_TOKEN;
const ONFIDO_BASE_URL = 'https://api.onfido.com/v3.6'; // or 'https://api.eu.onfido.com/v3.6' for EU

const onfidoApi = axios.create({
  baseURL: ONFIDO_BASE_URL,
  headers: {
    'Authorization': `Token token=${ONFIDO_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testConnection() {
  try {
    const response = await onfidoApi.get('/applicants');
    console.log('[SUCCESS] API Connection Working!');
    console.log('Applicants:', response.data);
    return true;
  } catch (error) {
    console.error('[ERROR] API Connection Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

async function createTestApplicant() {
  try {
    const response = await onfidoApi.post('/applicants', {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com'
    });
    console.log('[SUCCESS] Applicant Created:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('[ERROR] Applicant Creation Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return null;
  }
}

async function generateSDKToken(applicantId) {
    try {
      const response = await onfidoApi.post('/sdk_token', {
        applicant_id: applicantId,
        referrer: new URL(process.env.FRONTEND_URL || 'http://localhost:3000').origin + '/*'
      });
      console.log('[SUCCESS] SDK Token:', response.data.token);
      return response.data.token;
    } catch (error) {
      console.error('[ERROR] SDK Token Generation Failed:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      return null;
    }
  }

(async () => {
  console.log('Starting Onfido API tests...');
  
  const isConnected = await testConnection();
  if (!isConnected) return;

  const applicantId = await createTestApplicant();
  if (!applicantId) return;

  await generateSDKToken(applicantId);
})();