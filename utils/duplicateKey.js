function duplicateField(error) {
  const fields = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (fields.length) return fields[0];

  const message = String(error?.message || '');
  const match = message.match(/index:\s+([A-Za-z0-9_]+)_1\s+dup key/i);
  if (match) return match[1];
  return null;
}

function duplicateMessage(error, labels = {}) {
  if (error?.code !== 11000) return error?.message || 'The record could not be saved.';

  const field = duplicateField(error);
  if (field && labels[field]) return `${labels[field]} already exists. Please use a different value.`;
  if (field) return `A record with this ${field} already exists. Please use a different value.`;
  return 'A duplicate value conflicts with an existing database record. Check the unique fields and try again.';
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

module.exports = { duplicateField, duplicateMessage, isDuplicateKey };
