const { badRequest } = require('../errors/httpError');
const { validateLocation } = require('../utils/geo');
const Ad = require('../models/Add');
const User = require('../models/User');
const { getAdHighlightStatus } = require('../utils/highlight');
const Category = require('../models/Category');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const createAd = async (adData, userId) => {
  try {
    // Enforce subscription plan limits
    const activeSub = await UserSubscription.findOne({ user: userId, status: 'active' }).populate('plan');
    if (!activeSub || !activeSub.plan) {
      throw badRequest('You must have an active subscription to create a listing.', 403);
    }
    // Count current ads for this user
    const currentAdsCount = await Ad.countDocuments({ createdBy: userId });
    if (currentAdsCount >= activeSub.plan.listingLimit) {
      throw badRequest(`You have reached your plan's listing limit (${activeSub.plan.listingLimit}). Upgrade your plan to add more listings.`, 403);
    }
    // Enforce featured ad limit
    if (adData.isHighlighted) {
      const currentFeaturedCount = await Ad.countDocuments({ createdBy: userId, isHighlighted: true });
      if (currentFeaturedCount >= activeSub.plan.featuredAds) {
        throw badRequest(`You have reached your plan's featured ad limit (${activeSub.plan.featuredAds}).`, 403);
      }
    }

    const existingAd = await Ad.findOne({ title: adData.title, createdBy: userId });

    if (existingAd) {
      throw badRequest('You already have an ad with this title', 400);
    }
    // Validate locations
    const pickupLocation = await validateLocation(adData.pickupAddress);
    const returnLocation = await validateLocation(adData.returnAddress);
    
    if (!pickupLocation || !returnLocation) {
      throw badRequest('Invalid address', 400);
    }

    // Calculate highlight expiration if needed
    let highlightExpiresAt = null;
    if (adData.isHighlighted) {
      highlightExpiresAt = new Date();
      highlightExpiresAt.setDate(highlightExpiresAt.getDate() + 30); // 30 days from now
    }

    // Create and save ad
    const ad = new Ad({
      title: adData.title,
      description: adData.description,
      price: adData.price,
      photos: adData.photos,
      category: adData.category,
      subcategory: adData.subcategory || null,
      pickupLocation,
      returnLocation,
      isHighlighted: adData.isHighlighted || false,
      highlightExpiresAt,
      wasHighlighted: adData.isHighlighted || false, // Track if it was ever highlighted
      deposit: adData.deposit || 0,
      availability: adData.availability,
      loanPeriod: adData.loanPeriod,
      paymentMethods: adData.paymentMethods,
      contractTemplate: adData.contractTemplate,
      loanCondition: adData.loanCondition,
      createdBy: userId,
      rankingData: {
        score: 0,
        lastCalculated: new Date(),
        engagement: {
          viewCount: 0,
          contactCount: 0,
          saveCount: 0
        }
      }
    });

    await ad.save();

    return {
      success: true,
      ad
    };

  } catch (error) {
    console.error('Ad service error:', error);
    throw error;
  }
};

const createDraftAd = async (adData, userId) => {
  try {
    
    const existingAd = await Ad.findOne({ title: adData.title, createdBy: userId });

    if (existingAd) {
      throw badRequest('You already have an ad with this title', 400);
    }
    // Validate locations
    const pickupLocation = await validateLocation(adData.pickupAddress);
    const returnLocation = await validateLocation(adData.returnAddress);
    
    if (!pickupLocation || !returnLocation) {
      throw badRequest('Invalid address', 400);
    }

    // Calculate highlight expiration if needed
    let highlightExpiresAt = null;
    if (adData.isHighlighted) {
      highlightExpiresAt = new Date();
      highlightExpiresAt.setDate(highlightExpiresAt.getDate() + 30); // 30 days from now
    }

    // Create and save ad
    const ad = new Ad({
      title: adData.title,
      description: adData.description,
      price: adData.price,
      photos: adData.photos,
      category: adData.category,
      subcategory: adData.subcategory || null,
      pickupLocation,
      returnLocation,
      status:'draft',
      isHighlighted: adData.isHighlighted || false,
      highlightExpiresAt,
      wasHighlighted: adData.isHighlighted || false, // Track if it was ever highlighted
      deposit: adData.deposit || 0,
      availability: adData.availability,
      loanPeriod: adData.loanPeriod,
      paymentMethods: adData.paymentMethods,
      contractTemplate: adData.contractTemplate,
      loanCondition: adData.loanCondition,
      createdBy: userId,
      rankingData: {
        score: 0,
        lastCalculated: new Date(),
        engagement: {
          viewCount: 0,
          contactCount: 0,
          saveCount: 0
        }
      }
    });

    await ad.save();

    return {
      success: true,
      ad
    };

  } catch (error) {
    console.error('Ad service error:', error);
    throw error;
  }
};

const previewAd = async (adData) => {
  try {
    // Validate locations
    const pickupLocation = await validateLocation(adData.pickupAddress);
    const returnLocation = await validateLocation(adData.returnAddress);
    
    if (!pickupLocation || !returnLocation) {
      throw badRequest('Invalid address', 400);
    }

    // Calculate placement and estimates
    const mockPlacement = adData.isHighlighted ? 'HIGHLIGHTED' : 
                         adData.price > 1000 ? 'FEATURED' : 'STANDARD';
    
    const previewData = {
      ...adData,
      pickupLocation,
      returnLocation,
      mockPlacement,
      estimatedViews: calculateViews(adData.price, adData.category),
      estimatedRank: estimateRank({
        price: adData.price,
        isHighlighted: adData.isHighlighted,
        category: adData.category,
        availability: adData.availability
      }),
      // Add any other preview-specific fields
      previewGeneratedAt: new Date()
    };

    // Remove sensitive or unnecessary fields from preview
    delete previewData.createdBy;
    delete previewData.rankingData;
    delete previewData.boost;

    return {
      success: true,
      preview: previewData
    };

  } catch (error) {
    console.error('Preview service error:', error);
    throw error;
  }
};

const getAllRankedAds = async () => {
  try {
    // 1. Fetch Featured Ads (Active boosts)
    const featuredAds = await Ad.find({
      'boost.boostType': 'featured',
      'boost.expiresAt': { $gt: new Date() }, // Only active boosts
      status: 'published'
    })
    .sort({ 'boost.expiresAt': -1 }) // Newest boosts first
    .lean();

    // 2. Fetch Standard Ads (Ranked by score + recency)
    const standardAds = await Ad.find({
      $or: [
        { 'boost.boostType': 'none' },
        { 'boost.boostType': 'profile-rank' }
      ],
      status: 'published'
    })
    .sort({ 
      'rankingData.score': -1, // Highest score first
      createdAt: -1 // Newest first if scores tie
    })
    .lean();

    // 3. Combine results (featured first, then standard)
    return {
      success: true,
      ads: [...featuredAds, ...standardAds]
    };

  } catch (error) {
    console.error('[Get All Ads Error]:', error);
    throw error;
  }
};

const applyBoost = async (adId, boostType, durationDays, userId) => {
  try {
    const ad = await Ad.findOne({ _id: adId, createdBy: userId });
    if (!ad) throw badRequest('Ad not found or unauthorized');

    // Handle boost conflicts
    if (boostType === 'profile-rank' && ad.boost.boostType === 'featured') {
      throw badRequest('Featured ads cannot have profile-rank boost', 400); // Explicit 400 status
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    ad.boost = { 
      boostType, 
      expiresAt,
      appliedAt: new Date() 
    };

    // Recalculate score when applying boost
    if (boostType === 'featured') {
      ad.status = 'published'; // Auto-publish featured ads
    }

    await ad.save();

    // Update ranking if needed
    if (boostType === 'profile-rank') {
      await updateUserAdsRanking(userId);
    } else {
      await calculateAdScore(adId, true);
    }

    return {
      success: true,
      ad
    };
  } catch (error) {
    console.error('Boost service error:', error);
    if (error.isOperational) throw error; 
    throw new Error('Internal server error'); 
  
  }
};

const calculateAdScore = async (adId, forceUpdate = false) => {
  const ad = await Ad.findById(adId);
  if (!ad) throw badRequest('Ad not found');

  const hoursSinceLastCalc = (new Date() - ad.rankingData.lastCalculated) / (1000 * 60 * 60);
  if (!forceUpdate && hoursSinceLastCalc < 6) return ad;

  const user = await User.findById(ad.createdBy);
  const now = new Date();
  let score = 0;

  // Base score calculation
  const ageInHours = (now - ad.createdAt) / (1000 * 60 * 60);
  score += 100 / (1 + Math.log1p(ageInHours));
  score += ad.rankingData.engagement.viewCount * 0.1;
  score += ad.rankingData.engagement.contactCount * 0.5;
  score += ad.rankingData.engagement.saveCount * 0.3;

  // Apply profile boost if active
  if (user?.profileBoost?.isActive && user.profileBoost.expiresAt > now) {
    score *= user.profileBoost.boostMultiplier || 1.3;
  }

  ad.rankingData.score = Math.round(score);
  ad.rankingData.lastCalculated = now;
  await ad.save();

  return ad;
};

const updateUserAdsRanking = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw badRequest('User not found');

  const hasActiveProfileBoost = user.profileBoost?.isActive && 
  user.profileBoost.expiresAt > new Date();

  const ads = await Ad.find({ createdBy: userId });
  const bulkOps = ads.map(ad => {
    let score = 0;
    const ageInHours = (new Date() - ad.createdAt) / (1000 * 60 * 60);
    score += 100 / (1 + Math.log1p(ageInHours));
    score += ad.rankingData.engagement.viewCount * 0.1;
    score += ad.rankingData.engagement.contactCount * 0.5;
    score += ad.rankingData.engagement.saveCount * 0.3;

    if (hasActiveProfileBoost) {
      score *= user.profileBoost.boostMultiplier || 1.3;
    }

    return {
      updateOne: {
        filter: { _id: ad._id },
        update: {
          'rankingData.score': Math.round(score),
          'rankingData.lastCalculated': new Date()
        }
      }
    };
  });

  if (bulkOps.length > 0) {
    await Ad.bulkWrite(bulkOps);
  }
};

const applyProfileBoost = async (userId, durationDays) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw badRequest('User not found');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Activate profile boost
    user.profileBoost = {
      isActive: true,
      expiresAt,
      boostMultiplier: 1.3, // Default multiplier
    };
    await user.save();

    // Update all user ads' rankings
    await updateUserAdsRanking(userId);

    return {
      success: true,
      user,
      message: "Profile boost applied to all ads",
    };
  } catch (error) {
    console.error('Profile boost error:', error);
    throw error;
  }
};

function calculateViews(price, category) {
  const baseViews = 100;
  const priceMultiplier = 1 - (price / 5000);
  const categoryBoost = category === 'Electronics' ? 1.5 : 1;
  return Math.floor(baseViews * priceMultiplier * categoryBoost);
}

function estimateRank(adData) {
  // Simple mock ranking estimation
  let score = 50; // Base score
  
  // Price effect (lower prices rank higher)
  score += (1000 - Math.min(adData.price, 1000)) / 20;
  
  // Category adjustment
  if (adData.category === 'Electronics') score += 20;
  if (adData.category === 'Vehicles') score += 10;
  
  return Math.min(Math.max(score, 0), 100); // Clamp between 0-100
}

const hasActiveBookingsForAd = async (adId) => {
  const now = new Date();
  const activeBooking = await Booking.findOne({
    ad: adId,
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      { startDate: { $gte: now } },
      { endDate: { $gte: now } }
    ]
  });
  return !!activeBooking;
};

const updateAd = async (adId, userId, updateData) => {
  try {
    // 1. Find the ad and verify ownership
    const ad = await Ad.findOne({ _id: adId, createdBy: userId });
    if (!ad) {
      throw new Error('Ad not found or unauthorized');
    }

    // 2. Process location updates if needed
    if (updateData.pickupAddress) {
      ad.pickupLocation = await validateLocation(updateData.pickupAddress);
      delete updateData.pickupAddress;
    }

    if (updateData.returnAddress) {
      ad.returnLocation = await validateLocation(updateData.returnAddress);
      delete updateData.returnAddress;
    }

    // 3. Update fields
    Object.keys(updateData).forEach(key => {
      if (key === 'availability') {
        // Handle nested availability object
        ad.availability = { ...ad.availability, ...updateData.availability };
      } else if (updateData[key] !== undefined) {
        ad[key] = updateData[key];
      }
    });

    // 4. Save and return updated ad
    await ad.save();
    return {
      success: true,
      ad
    };

  } catch (error) {
    console.error('Update ad service error:', error);
    throw error;
  }
};

const deleteAd = async (adId, userId) => {
  try {
    // Find and delete in one operation
    const result = await Ad.deleteOne({ 
      _id: adId, 
      createdBy: userId 
    });

    if (result.deletedCount === 0) {
      return { 
        success: false, 
        error: "Ad not found or unauthorized" 
      };
    }

    return { 
      success: true 
    };

  } catch (error) {
    console.error("[Delete Ad Error]:", error);
    throw error;
  }
};

const getUserAds = async (userId) => {
  try {
    const ads = await Ad.find({ 
      createdBy: userId,
      status: { $ne: 'deleted' }
    })
    .sort({ createdAt: -1 })
    .populate('category', 'name')
    .lean();

    // Map ads and populate subcategories
    const adsWithSubcategories = await Promise.all(
      ads.map(async (ad) => {
        if (ad.subcategory) {
          const categoryWithSubs = await Category.findOne(
            { 'subcategories._id': ad.subcategory },
            { 'subcategories.$': 1 }
          ).lean();
          
          ad.subcategory = categoryWithSubs?.subcategories?.[0] || null;
        } else {
          ad.subcategory = null;
        }

        return {
          ...ad,
          highlightStatus: getAdHighlightStatus(ad)
        };
      })
    );

    return {
      success: true,
      ads: adsWithSubcategories
    };

  } catch (error) {
    console.error('Get user ads service error:', error);
    throw error;
  }
};


const getAdDetails = async (adId, userId = null) => {
  try {
    // Find the ad by ID and populate relevant fields
    const ad = await Ad.findById(adId)
      .populate('createdBy', 'first_name last_name phoneNumber sellerRating createdAt')
      .populate('category', 'name')
      .populate('contractTemplate', 'name')
      .lean();

    if (!ad) {
      throw badRequest('Ad not found', 404);
    }

    // Manually populate subcategory if it exists
    if (ad.subcategory) {
      const categoryWithSubs = await Category.findOne({
        'subcategories._id': ad.subcategory
      }, {
        'subcategories.$': 1
      }).lean();
    
      if (categoryWithSubs?.subcategories?.length) {
        ad.subcategory = categoryWithSubs.subcategories[0];
      } else {
        ad.subcategory = null;
      }
    }

    // Add user's total published ads count
    if (ad.createdBy) {
      const publishedAdsCount = await Ad.countDocuments({
        createdBy: ad.createdBy._id,
        status: 'published'
      });
      ad.createdBy.publishedAdsCount = publishedAdsCount;
    }

    // Increment view count
    await Ad.findByIdAndUpdate(adId, {
      $inc: { 'rankingData.engagement.viewCount': 1 }
    }).exec();

    return {
      success: true,
      ad
    };

  } catch (error) {
    console.error('Get Ad Details Service Error:', error);
    throw error;
  }
};

const searchRentals = async (filters = {}) => {
  try {
    const {
      title,
      location,
      priceMin,
      priceMax,
      category,
      subcategory,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    // Base query for published ads
    const query = { status: 'published' };

    // Title search (case-insensitive)
    if (title) {
      query.title = { $regex: title, $options: 'i' };
    }

    // Location filter (using geoNear if coordinates provided)
    if (location?.coordinates) {
      query['pickupLocation.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: location.coordinates
          },
          $maxDistance: location.radius || 5000 // Default 5km radius
        }
      };
    } else if (location?.address) {
      query['pickupLocation.address'] = new RegExp(location.address, 'i');
    }

    // Price range filter
    if (priceMin || priceMax) {
      query.price = {};
      if (priceMin) query.price.$gte = Number(priceMin);
      if (priceMax) query.price.$lte = Number(priceMax);
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Subcategory filter
    if (subcategory) {
      query.subcategory = subcategory;
    }

    // Date range availability filter
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(startDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days if no end date

      // Check if the dates are available (not in bookedDates or confirmedBookings)
      query.$and = [
        {
          $or: [
            { bookedDates: { $not: { $elemMatch: { $gte: start, $lte: end } } } },
            { bookedDates: { $exists: false } }
          ]
        },
        {
          $or: [
            { confirmedBookings: { $not: { $elemMatch: { $gte: start, $lte: end } } } },
            { confirmedBookings: { $exists: false } }
          ]
        }
      ];
    }

    // Sort options
    const sortOptions = {};
    if (sortBy === 'price') {
      sortOptions.price = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'rating') {
      sortOptions['createdBy.sellerRating.average'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    // Execute search with pagination
    const results = await Ad.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'first_name sellerRating')
      .populate('category', 'name')
      .lean();

    const totalCount = await Ad.countDocuments(query);

    return {
      success: true,
      results,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };

  } catch (error) {
    throw error;
  }
};

const getAdDescription = async (adId) => {
  try {
    const ad = await Ad.findById(adId).select('description').lean();
    if (!ad) {
      throw badRequest('Ad not found', 404);
    }
    return {
      success: true,
      description: ad.description || ''
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createAd,
  previewAd,
  getAllRankedAds,
  applyBoost,
  calculateAdScore,
  updateUserAdsRanking,
  applyProfileBoost,
  updateAd,
  deleteAd,
  hasActiveBookingsForAd,
  createDraftAd,
  getUserAds,
  getAdDetails,
  searchRentals,
  getAdDescription
};