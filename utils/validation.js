const mongoose = require('mongoose');

function cleanText(value, maxLength = 150) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeCode(value, maxLength = 60) {
  return cleanText(value, maxLength).toUpperCase();
}

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPagination(query = {}) {
  const pageValue = Number.parseInt(query.page, 10);
  const limitValue = Number.parseInt(query.limit, 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(10, limitValue)) : 25;
  return { page, limit, skip: (page - 1) * limit };
}

function buildPagination(total, page, limit, query = {}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const queryString = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'page' && value !== undefined && value !== null && String(value).trim() !== '') {
      queryString.set(key, String(value));
    }
  }
  return {
    page,
    limit,
    total,
    pages,
    hasPrevious: page > 1,
    hasNext: page < pages,
    previousUrl: `?${queryString.toString()}${queryString.toString() ? '&' : ''}page=${Math.max(1, page - 1)}`,
    nextUrl: `?${queryString.toString()}${queryString.toString() ? '&' : ''}page=${Math.min(pages, page + 1)}`
  };
}

function parsePositiveInteger(value, fieldName, max = 100000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`${fieldName} must be a whole number between 1 and ${max}.`);
  }
  return number;
}

function parseDate(value, fieldName = 'date') {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`Please enter a valid ${fieldName.toLowerCase()}.`);
  }
  return date;
}

module.exports = {
  cleanText,
  normalizeCode,
  isValidObjectId,
  escapeRegex,
  getPagination,
  buildPagination,
  parsePositiveInteger,
  parseDate
};
