const mongoose = require('mongoose');

function cleanText(value, maxLength = 150) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePositiveInteger(value, fieldName, max = 100000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`${fieldName} must be a whole number between 1 and ${max}.`);
  }
  return number;
}

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`Please enter a valid ${fieldName.toLowerCase()}.`);
  }
  return date;
}

module.exports = { cleanText, isValidObjectId, parsePositiveInteger, parseDate, escapeRegex };
