const { CustomError } = require('../errors/CustomeError');
const { badRequest } = require('../errors/httpError');
const Add = require('../models/Add');
const { 
  createAd, 
  previewAd, 
  getRankedAds, 
  applyBoost,
  calculateAdScore,
  updateUserAdsRanking,
  applyProfileBoost,
  hasActiveBookingsForAd,
  updateAd,
  deleteAd,
  getAllRankedAds,
  createDraftAd,
  getUserAds,
  getAdDetails,
  searchRentals,
  getAdDescription
} = require('../services/adService');
const { getProfile } = require('../services/authService');
const { createAdSchema, updateAdSchema } = require('../validations/adSchemaValidation');

const createAdController = async (req, res, next) => {
  try {
    // 1. Validate input using Zod
    const validationResult = await createAdSchema.safeParseAsync(req.body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(e => e.message).join(', ');
      return res.status(400).json({
        success: false,
        error: errorMessages
      });
    }

    // 2. Call service
    const { success, ad } = await createAd(validationResult.data, req.user._id);

    // 3. Send success response
    return res.status(201).json({
      success,
      ad
    });

  } catch (error) {
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    
    next(error);
  }
};

const createDraftAdController = async (req, res, next) => {
  try {
    // 1. Validate input using Zod
    const validationResult = await createAdSchema.safeParseAsync(req.body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(e => e.message).join(', ');
      return res.status(400).json({
        success: false,
        error: errorMessages
      });
    }

    // 2. Call service
    const { success, ad } = await createDraftAd(validationResult.data, req.user._id);

    // 3. Send success response
    return res.status(201).json({
      success,
      ad
    });

  } catch (error) {
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    
    next(error);
  }
};

const previewAdController = async (req, res, next) => {
  try {
    // 1. Validate input using the same schema as createAd
    const validationResult = await createAdSchema.safeParseAsync(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }

    // 2. Generate preview
    const { success, preview } = await previewAd(validationResult.data);

    // 3. Return preview
    res.status(200).json({
      success,
      preview
    });

  } catch (error) {
    next(error);
  }
};

const getAllAdsController = async (req, res, next) => {
  try {
    const { success, ads } = await getAllRankedAds();

    res.status(200).json({
      success,
      count: ads.length,
      ads
    });

  } catch (error) {
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

const applyAdBoostController = async (req, res, next) => {
  try {
    const { boostType, durationDays } = req.body;
    
    // Validate boost type
    if (!['featured', 'profile-rank'].includes(boostType)) {
      throw badRequest('Invalid boost type');
    }

    // Validate  duration
    if (!durationDays || durationDays < 1 || durationDays > 30) {
      throw badRequest('Duration must be between 1 and 30 days');
    }

    const { success, ad } = await applyBoost(
      req.params.id,
      boostType,
      durationDays,
      req.user._id
    );

    res.json({ 
      success, 
      ad,
      message: `${boostType.replace('-', ' ')} boost applied successfully`
    });

  }  catch (error) {
    // Pass operational errors (like 400) directly to the client
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    next(error); // Forward non-operational errors to global handler
  }

};

// New controller for manual score recalculation
const recalculateScoreController = async (req, res, next) => {
  try {
    const { adId } = req.params;
    const { force } = req.query;

    const ad = await calculateAdScore(
      adId, 
      force === 'true' // Convert string to boolean
    );

    res.json({
      success: true,
      ad,
      message: 'Score recalculated successfully'
    });

  } catch (error) {
    next(error);
  }
};


const updateUserRankingController = async (req, res, next) => {
  try {
    const updatedCount = await updateUserAdsRanking(req.user._id);

    res.json({
      success: true,
      updatedCount,
      message: `Ranking updated for ${updatedCount} ads`
    });

  } catch (error) {
    next(error);
  }
};

const applyProfileBoostController = async (req, res, next) => {
  try {
    const { durationDays } = req.body;
    const { success, user, message } = await applyProfileBoost(
      req.user._id, 
      durationDays
    );
    res.json({ success, user, message });
  } catch (error) {
    next(error);
  }
};

const deleteAdController = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: "Ad ID is required" 
      });
    }

    const { success, error } = await deleteAd(id, req.user._id);

    if (!success) {
      return res.status(error === "Ad not found" ? 404 : 403).json({ 
        success: false, 
        error 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Ad  deleted successfully " 
    });

  } catch (err) {
    next(err);
  }
};

const updateAdController = async (req, res, next) => {
  try {
    // 1. Validate input
    const validationResult = await updateAdSchema.safeParseAsync(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }

    // 2. Call service
    const { success, ad } = await updateAd(
      req.params.id,
      req.user._id,
      validationResult.data
    );

    // 3. Return response
    res.status(200).json({
      success,
      ad
    });

  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('unauthorized')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

const getUserAdsController = async (req, res, next) => {
  try {
    // 1. Get user ID from authenticated request
    const userId = req.user._id;
    
    // 2. Call service to get user's ads
    const { success, ads } = await getUserAds(userId);
    const user=await getProfile(userId)
    // 3. Return response
    res.status(200).json({
      user,
      success,
      count: ads.length,
      ads
    });

  } catch (error) {
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

// const getAdDetailsController = async (req, res, next) => {
//   try {
//     console.log(req.params.id)
//     // Validate ad ID
//     if (!req.params.id) {

//       return res.status(400).json({
//         success: false,
//         error: 'Invalid ad ID'
//       });
//     }

//     // Call service (passing the authenticated user ID if available)
//     const { success, ad } = await getAdDetails(
//       req.params.id, 
//       req.user?._id
//     );

//     // Send success response
//     return res.status(200).json({
//       success,
//       ad
//     });

//   } catch (error) {
//     if (error.isOperational) {
//       return res.status(error.statusCode || 400).json({
//         success: false,
//         error: error.message
//       });
//     }
    
//     next(error);
//   }
// };
const getAdDetailsController = async (req, res, next) => {
  try {
    // Extract the full string from query params
    const fullIdString = req.query._id;
    
    // Validate
    if (!fullIdString) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ad ID'
      });
    }

    // Extract just the MongoDB ID (last part after last underscore)
    const mongoId = fullIdString.split('_').pop();
    
    // Optional: Validate it's a proper MongoDB ID format
    if (!mongoose.Types.ObjectId.isValid(mongoId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ad ID format'
      });
    }

    // Call service with the extracted ID
    const { success, ad } = await getAdDetails(mongoId, req.user?._id);

    return res.status(200).json({
      success,
      ad
    });

  } catch (error) {
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

const searchRentalsController = async (req, res, next) => {
  try {
    const filters = {
      title: req.query.title,
      location: req.query.location && JSON.parse(req.query.location),
      priceMin: req.query.priceMin,
      priceMax: req.query.priceMax,
      category: req.query.category,
      subcategory: req.query.subcategory,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc'
    };

    const { success, results, pagination } = await searchRentals(filters);

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No rentals found matching your criteria',
        results: [],
        pagination
      });
    }

    return res.status(200).json({
      success,
      results,
      pagination
    });

  } catch (error) {
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

const getAdDescriptionController = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Ad ID is required'
      });
    }
    const { success, description } = await getAdDescription(id);
    return res.status(200).json({ success, description });
  } catch (error) {
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};
module.exports = {
  createAdController,
  previewAdController,
  getAllAdsController,
  applyAdBoostController,
  recalculateScoreController,
  updateUserRankingController,
  applyProfileBoostController,
  updateAdController,
  deleteAdController,
  createDraftAdController,
  getUserAdsController,
  getAdDetailsController,
  searchRentalsController,
  getAdDescriptionController
  
};
