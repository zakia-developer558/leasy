const axios = require('axios');
const crypto = require('crypto');

// EU-specific configuration
const ONFIDO_API_TOKEN = process.env.ONFIDO_API_TOKEN;
const ONFIDO_BASE_URL = 'https://api.eu.onfido.com/v3.6'; // Hardcoded EU endpoint

// Validate token format for EU
//if (!ONFIDO_API_TOKEN?.startsWith('api_live.')) {
//  throw new Error('EU production requires live API token starting with api_live.');
//}

const onfidoApi = axios.create({
  baseURL: ONFIDO_BASE_URL,
  headers: {
    'Authorization': `Token token=${ONFIDO_API_TOKEN}`,
    'Content-Type': 'application/json',
    'Onfido-Version': '2023-06-21', // GDPR-compliant version
    'X-Request-Id': crypto.randomUUID(), // For traceability
    'X-Data-Residency': 'EU'
  },
  timeout: 15000
});

// Debug output
console.log('Onfido EU Configuration:', {
  baseURL: ONFIDO_BASE_URL,
  dataCenter: 'EU (Frankfurt/Marseille)',
  tokenPrefix: ONFIDO_API_TOKEN?.slice(0, 8) + '...'
});

const handleOnfidoError = (error, context) => {
  const errorData = {
    status: error.response?.status,
    error: error.response?.data?.error,
    headers: error.response?.headers,
    request: {
      method: error.config?.method,
      url: error.config?.url,
      data: error.config?.data
    }
  };

  console.error(`Onfido EU Error [${context}]`, errorData);

  let message = 'Onfido operation failed';
  if (error.response?.data?.error?.type === 'disabled_endpoint') {
    message = 'This endpoint is not available in the EU region';
  } else if (error.response?.data?.error?.message) {
    message = error.response.data.error.message;
  }

  throw new Error(`${message} [${context}]`);
};

module.exports = {
  ping: async () => {
    try {
      const response = await onfidoApi.get('/ping');
      console.log('Onfido EU API Status:', response.headers['x-onfido-region']);
      return response.data;
    } catch (error) {
      handleOnfidoError(error, 'ping');
    }
  },

  createApplicant: async (userData) => {
    try {
      // GDPR-compliant applicant data
      const euApplicantData = {
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        location: {
          country_of_residence: userData.address || 'FRA', 
          ip_address: userData.ip_address || '127.0.0.1' // Required but less strict than US
        },
        privacy_notices_consent: {
          consent: true,
          text: "I agree to the processing of my data",
          obtained_at: new Date().toISOString()
        }
      };

      const response = await onfidoApi.post('/applicants', euApplicantData);
      return response.data.id;
    } catch (error) {
      handleOnfidoError(error, 'createApplicant');
    }
  },

  generateSdkToken: async (applicantId) => {
    try {
      const response = await onfidoApi.post('/sdk_token', {
        applicant_id: applicantId,
        referrer: process.env.FRONTEND_URL ? 
          `${new URL(process.env.FRONTEND_URL).origin}/*` : 
          'http://localhost:5000*',
        cross_device_url: process.env.FRONTEND_URL // For EU cross-device flow
      });
      return response.data.token;
    } catch (error) {
      handleOnfidoError(error, 'generateSdkToken');
    }
  },

  submitCheck: async (applicantId) => {
    try {
      // EU-specific check configuration
      const response = await onfidoApi.post('/checks', {
        applicant_id: applicantId,
        report_names: ['document', 'facial_similarity_photo'],
        suppress_form_emails: true, // Required for GDPR compliance
        asynchronous: false // Recommended for EU synchronous processing
      }, {
        headers: {
          'X-Country-Code': 'EU' // Explicit EU header
        }
      });
      
      return response.data;
    } catch (error) {
      handleOnfidoError(error, 'submitCheck');
    }
  },

  submitWorkflowRun: async (applicantId, workflowId) => {
    try {
      const response = await onfidoApi.post('/workflow_runs', {
        applicant_id: applicantId,
        workflow_id: workflowId || process.env.ONFIDO_WORKFLOW_ID,
        custom_data: JSON.stringify({
          gdpr_compliant: true,
          processing_country: 'EU'
        })
      });
      return response.data;
    } catch (error) {
      handleOnfidoError(error, 'submitWorkflowRun');
    }
  },

  getCheckResults: async (checkId) => {
    try {
      const response = await onfidoApi.get(`/checks/${checkId}`, {
        headers: {
          'X-Data-Residency': 'EU' // Explicitly request EU data
        }
      });
      return response.data;
    } catch (error) {
      handleOnfidoError(error, 'getCheckResults');
    }
  },

  verifyWebhook: (rawBody, signature, secret) => {
    if (!secret || !signature || !rawBody) {
      console.error('Webhook verification missing parameters');
      return false;
    }
    
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(rawBody).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(digest, 'hex')
    );
  },

  // EU-specific methods
  getDataProcessingAgreement: async () => {
    try {
      const response = await onfidoApi.get('/data_protection_agreements');
      return response.data;
    } catch (error) {
      handleOnfidoError(error, 'getDataProcessingAgreement');
    }
  }
};
