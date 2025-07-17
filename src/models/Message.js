const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  adContext: { type: mongoose.Schema.Types.ObjectId, ref: 'Ad' }, // which item this message is about
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

messageSchema.index({ chatId: 1 });

module.exports = mongoose.model('Message', messageSchema); 