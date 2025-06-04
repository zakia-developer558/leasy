const ApiError = require("./ApiErrors");


const badRequest = (message) => new ApiError(400, message);
const notFound = (message) => new ApiError(404, message);
// Add more as needed (unauthorized, forbidden, etc.)

module.exports = { badRequest, notFound };