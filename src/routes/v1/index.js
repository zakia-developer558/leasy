const express = require('express');
const authRouter = require('./authRoutes');
const adRouter = require('./adRoutes');
const catRouter = require('./categoryRoutes')
const bookRouter = require('./bookingRoutes')
const shipRouter = require('./shipmentRoutes')
const subRouter = require('./subscriptionRoutes')
const chatRouter = require('./chatRoutes');
const notificationRouter = require('./notificationRoutes');

const v1Router = express.Router();

v1Router.use('/auth', authRouter);
v1Router.use('/ad', adRouter);
v1Router.use('/cat',catRouter);
v1Router.use('/book',bookRouter);
v1Router.use('/ship',shipRouter);
v1Router.use('/sub',subRouter);
v1Router.use('/chat', chatRouter);
v1Router.use('/notification', notificationRouter);


module.exports = v1Router;