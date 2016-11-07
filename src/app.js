'use strict';

const R53ddnslmd = require('./R53ddnslmd');

const app = new R53ddnslmd();

exports.handler = app.getMainHandler();
