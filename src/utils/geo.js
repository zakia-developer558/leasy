const { Client } = require('@googlemaps/google-maps-services-js');
const { badRequest } = require('../errors/httpError');

const client = new Client();

exports.validateLocation = async (address) => {
  try {
    // Basic validation
    if (!address || typeof address !== 'string') {
      throw badRequest('Please enter a valid address');
    }

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 3) {
      throw badRequest('Address is too short');
    }

    const response = await client.geocode({
      params: {
        address: trimmedAddress,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    // Handle API errors
    if (response.data.status === 'ZERO_RESULTS') {
      throw badRequest('Address not found. Please try a more specific location');
    }

    if (response.data.status !== 'OK') {
      throw badRequest(`Location service error: ${response.data.error_message || 'Unknown error'}`);
    }

    const result = response.data.results[0];
    return {
      address: result.formatted_address,
      coordinates: [result.geometry.location.lng, result.geometry.location.lat]
    };

  } catch (error) {
    // Handle specific Google API errors
    if (error.response?.data?.error_message?.includes('not authorized')) {
      throw badRequest('Location service is currently unavailable. Please try again later.');
    }

    // Preserve existing 400 errors
    if (error.statusCode === 400) {
      throw error;
    }

    // Catch network errors
    if (error.code === 'ENOTFOUND') {
      throw badRequest('Network error - please check your internet connection');
    }

    // Fallback
    throw badRequest('Could not validate address. Please try again.');
  }
};