'use strict';

const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./config');

function issue({ model, trial, userId, ttl }) {
  return jwt.sign(
    { model, trial: !!trial, sub: userId || null },
    jwtSecret,
    { expiresIn: ttl }
  );
}

function verify(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { issue, verify };
