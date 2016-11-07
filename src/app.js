'use strict';

const R53ddnslmd = require('./R53ddnslmd');
const conf = require('dotenv-safe').load();

const app = new R53ddnslmd(conf);

exports.handler = app.mainHandler.bind(app);
