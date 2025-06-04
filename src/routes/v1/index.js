const express = require('express');
const authRouter = require('./authRoutes');
const adRouter = require('./adRoutes');
const catRouter = require('./categoryRoutes')
const bookRouter = require('./bookingRoutes')
const shipRouter = require('./shipmentRoutes')


const v1Router = express.Router();

v1Router.use('/auth', authRouter);
v1Router.use('/ad', adRouter);
v1Router.use('/cat',catRouter);
v1Router.use('/book',bookRouter);
v1Router.use('/ship',shipRouter);


module.exports = v1Router;