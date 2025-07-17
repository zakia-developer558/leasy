const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Ad = require('../models/Add');
const User = require('../models/User');
const { notifyUser } = require('../utils/notification');

// Borrower initiates chat with owner (if not exists)
const createChat = async (req, res, next) => {
  try {
    const renterId = req.user._id;
    const { ownerId, adId } = req.body;
    // Only borrower can initiate
    const ad = await Ad.findById(adId);
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' });
    if (String(ad.createdBy) !== String(ownerId)) return res.status(400).json({ success: false, error: 'Owner mismatch' });
    if (String(renterId) === String(ownerId)) return res.status(400).json({ success: false, error: 'Owner cannot initiate chat' });
    // Check if chat exists
    let chat = await Chat.findOne({ participants: { $all: [renterId, ownerId] } });
    if (chat) {
      // Add adRef if not present
      if (!chat.adRefs.some(ref => String(ref.adId) === String(adId))) {
        chat.adRefs.push({ adId, status: ad.status });
        await chat.save();
      }
      return res.json({ success: true, chat });
    }
    // Create new chat
    chat = new Chat({
      participants: [renterId, ownerId],
      initiator: renterId,
      adRefs: [{ adId, status: ad.status }],
      isOpen: true
    });
    await chat.save();
    res.status(201).json({ success: true, chat });
  } catch (error) {
    next(error);
  }
};

// List all chats for the authenticated user
const getUserChats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'first_name last_name email')
      .populate('adRefs.adId', 'title status');
    res.json({ success: true, chats });
  } catch (error) {
    next(error);
  }
};

// List messages for a chat
const getChatMessages = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
};

// Send a message in a chat
const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;
    const { text, adContext } = req.body;
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
    if (!chat.isOpen) return res.status(403).json({ success: false, error: 'Chat is closed for new messages' });
    if (!chat.participants.includes(userId)) return res.status(403).json({ success: false, error: 'Not a participant' });
    // Optionally: Only allow messages if at least one ad is not returned
    // (You can add more logic here if needed)
    const message = new Message({ chatId, senderId: userId, text, adContext });
    await message.save();
    // Notify the other participant
    const recipientId = chat.participants.find(id => id.toString() !== userId.toString());
    if (recipientId) {
      await notifyUser(recipientId, 'new_message', { chatId, messageId: message._id });
    }
    res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChat,
  getUserChats,
  getChatMessages,
  sendMessage
}; 