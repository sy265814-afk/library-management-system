require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabaseWithDnsFallback } = require('../app');
const repairLegacyIndexes = require('../config/repairLegacyIndexes');

(async () => {
  try {
    await connectDatabaseWithDnsFallback();
    await repairLegacyIndexes();
    console.log('Database index repair completed successfully.');
  } catch (error) {
    console.error('Database index repair failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
