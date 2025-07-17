const express = require('express');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { createChat, getUserChats, getChatMessages, sendMessage } = require('../../controllers/chatController');

const chatRouter = express.Router();

chatRouter.post('/create', authMiddleware, createChat);
chatRouter.get('/', authMiddleware, getUserChats);
chatRouter.get('/:chatId/messages', authMiddleware, getChatMessages);
chatRouter.post('/:chatId/message', authMiddleware, sendMessage);

module.exports = chatRouter; 