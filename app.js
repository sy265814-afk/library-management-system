require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const methodOverride = require('method-override');
const mongoose = require('mongoose');

const connectDatabase = require('./config/database');
const flashMiddleware = require('./middleware/flash');
const csrfProtection = require('./middleware/csrf');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const DNS_JSON_ENDPOINTS = [
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve'
];

async function queryDnsOverHttps(hostname, recordType) {
  let lastError;

  for (const endpoint of DNS_JSON_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('name', hostname);
      url.searchParams.set('type', recordType);

      const response = await fetch(url, {
        headers: endpoint.includes('cloudflare-dns.com')
          ? { accept: 'application/dns-json' }
          : { accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`DNS-over-HTTPS returned HTTP ${response.status}.`);
      }

      const result = await response.json();

      if (result.Status !== 0) {
        throw new Error(`DNS lookup failed with status ${result.Status}.`);
      }

      return Array.isArray(result.Answer) ? result.Answer : [];
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Could not query public DNS for ${hostname}: ${lastError?.message || 'Unknown DNS error'}`);
}

function readTxtRecord(value) {
  return String(value || '')
    .replace(/^"|"$/g, '')
    .replace(/"\s*"/g, '');
}

async function buildStandardMongoUri(srvUri) {
  const parsedUri = new URL(srvUri);

  if (parsedUri.protocol !== 'mongodb+srv:') {
    return srvUri;
  }

  const srvName = `_mongodb._tcp.${parsedUri.hostname}`;
  const srvAnswers = await queryDnsOverHttps(srvName, 'SRV');
  const srvRecords = srvAnswers
    .filter(answer => answer.type === 33)
    .map(answer => {
      const match = String(answer.data || '').match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
      if (!match) return null;

      return {
        priority: Number(match[1]),
        weight: Number(match[2]),
        port: Number(match[3]),
        host: match[4].replace(/\.$/, '')
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority);

  if (!srvRecords.length) {
    throw new Error(`No MongoDB SRV records were found for ${parsedUri.hostname}. Verify the cluster hostname in MongoDB Atlas > Connect > Drivers.`);
  }

  const txtOptions = new URLSearchParams();
  const txtAnswers = await queryDnsOverHttps(parsedUri.hostname, 'TXT');

  for (const answer of txtAnswers.filter(item => item.type === 16)) {
    const txtValue = readTxtRecord(answer.data);
    const recordOptions = new URLSearchParams(txtValue);
    for (const [key, value] of recordOptions.entries()) {
      txtOptions.set(key, value);
    }
  }

  const options = new URLSearchParams(txtOptions);
  for (const [key, value] of parsedUri.searchParams.entries()) {
    options.set(key, value);
  }

  if (!options.has('tls') && !options.has('ssl')) {
    options.set('tls', 'true');
  }

  const credentials = parsedUri.username
    ? `${parsedUri.username}${parsedUri.password ? `:${parsedUri.password}` : ''}@`
    : '';
  const hosts = srvRecords.map(record => `${record.host}:${record.port}`).join(',');
  const databasePath = parsedUri.pathname || '/';
  const queryString = options.toString();

  return `mongodb://${credentials}${hosts}${databasePath}${queryString ? `?${queryString}` : ''}`;
}

function isSrvDnsError(error) {
  const message = `${error?.message || ''} ${error?.cause?.message || ''}`;
  return /querySrv|ECONNREFUSED|ENOTFOUND|ETIMEOUT|ESERVFAIL/i.test(message);
}

async function connectDatabaseWithDnsFallback() {
  const originalUri = process.env.MONGODB_URI;

  if (!originalUri) {
    throw new Error('MONGODB_URI is missing. Add your MongoDB connection string to the .env file.');
  }

  try {
    await connectDatabase();
    return;
  } catch (error) {
    if (!originalUri.startsWith('mongodb+srv://') || !isSrvDnsError(error)) {
      throw error;
    }

    console.warn('MongoDB SRV DNS lookup failed. Trying secure DNS-over-HTTPS fallback...');
    await mongoose.disconnect();

    const standardUri = await buildStandardMongoUri(originalUri);
    process.env.MONGODB_URI = standardUri;

    try {
      await connectDatabase();
      console.log('MongoDB connected using the DNS-over-HTTPS seed-list fallback.');
    } catch (fallbackError) {
      process.env.MONGODB_URI = originalUri;
      throw new Error(`MongoDB connection failed after DNS fallback: ${fallbackError.message}`);
    }
  }
}

function createApp(sessionStore) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

  app.use(helmet());
  app.use(express.urlencoded({ extended: false, limit: '30kb' }));
  app.use(express.json({ limit: '30kb' }));
  app.use(methodOverride('_method'));
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
  }));

  app.use(session({
    name: 'library.sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8
    }
  }));

  app.use(flashMiddleware);

  app.use((req, res, next) => {
    res.locals.appName = process.env.APP_NAME || 'Library Management System';

    // Make the complete signed-in admin object available to every EJS view.
    // This fixes "admin is not defined" in dashboard and sidebar templates.
    res.locals.admin = req.session.admin || null;
    res.locals.adminUsername = req.session.admin?.username || '';

    res.locals.formatDate = value => value
      ? new Date(value).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : '—';

    res.locals.formatDateTime = value => value
      ? new Date(value).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '—';

    next();
  });

  app.use('/admin', csrfProtection);
  app.use('/admin', authRoutes);
  app.use('/admin', adminRoutes);

  app.get('/', (req, res) => res.redirect('/admin'));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

async function startServer() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be set in .env and contain at least 32 characters.');
  }

  await connectDatabaseWithDnsFallback();

  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
    ttl: 60 * 60 * 8,
    autoRemove: 'native'
  });

  const app = createApp(sessionStore);
  const port = Number(process.env.PORT) || 3005;
  const server = app.listen(port, () => {
    console.log(`${process.env.APP_NAME || 'Library Management System'} running at http://localhost:${port}`);
  });

  const shutdown = async signal => {
    console.log(`${signal} received. Shutting down...`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('Application startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  startServer,
  buildStandardMongoUri,
  connectDatabaseWithDnsFallback
};
