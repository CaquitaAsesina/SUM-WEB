const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });

const { authenticate } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ══════════════════════════════════════
// SECURITY HEADERS (Helmet)
// ══════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ══════════════════════════════════════
// CORS - Only allow same origin
// ══════════════════════════════════════
app.use(cors({
  origin: IS_PRODUCTION ? false : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// ══════════════════════════════════════
// BODY PARSERS with size limits
// ══════════════════════════════════════
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ══════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════

// General API rate limit - disabled in dev to avoid blocking normal use
const generalLimiter = IS_PRODUCTION
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 2000,
      message: { success: false, message: 'Demasiadas solicitudes. Espere un momento.' },
      standardHeaders: true,
      legacyHeaders: false
    })
  : (req, res, next) => next();

// Auth rate limit - disabled in dev
const authLimiter = IS_PRODUCTION
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: { success: false, message: 'Demasiados intentos de login.' },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true
    })
  : (req, res, next) => next();

// ══════════════════════════════════════
// SECURITY: Hide server info
// ══════════════════════════════════════
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ══════════════════════════════════════
// STATIC FILES - no directory listing
// ══════════════════════════════════════
app.use(express.static(path.join(__dirname, '../frontend'), {
  dotfiles: 'deny',
  index: false,
  fallthrough: true
}));

// Block access to sensitive files
app.use((req, res, next) => {
  const blocked = ['.env', '.git', 'node_modules', 'package.json', 'package-lock.json'];
  if (blocked.some(b => req.path.includes(b))) {
    return res.status(403).json({ success: false, message: 'Acceso denegado' });
  }
  next();
});

// ══════════════════════════════════════
// ROUTES
// ══════════════════════════════════════

// Auth routes with strict rate limiting
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Public health check endpoint (for Render)
app.get('/api/health', async (req, res) => {
  try {
    const connection = await db.getConnection();
    connection.release();
    res.json({ success: true, message: 'OK', db: 'connected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'DB connection failed', error: err.code || err.message });
  }
});

// Protected API routes with general rate limiting
app.use('/api', generalLimiter);
app.use('/api/productos', authenticate, require('./routes/productos'));
app.use('/api/areas', authenticate, require('./routes/areas'));
app.use('/api/asignaciones', authenticate, require('./routes/asignaciones'));
app.use('/api/periodos', authenticate, require('./routes/periodos'));
app.use('/api/picking', authenticate, require('./routes/picking'));
app.use('/api/auditorias', authenticate, require('./routes/auditorias'));
app.use('/api/movimientos', authenticate, require('./routes/movimientos'));
app.use('/api/dashboard', authenticate, require('./routes/dashboard'));
app.use('/api/usuarios', authenticate, require('./routes/usuarios'));
app.use('/api/trupal', authenticate, require('./routes/trupal'));
app.use('/api/trupal-productos', authenticate, require('./routes/trupalProductos'));

// ══════════════════════════════════════
// SPA FALLBACK (after API routes)
// ══════════════════════════════════════
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
  next();
});

// ══════════════════════════════════════
// 404 for unknown API routes
// ══════════════════════════════════════
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint no encontrado' });
});

// ══════════════════════════════════════
// GLOBAL ERROR HANDLER (no leak internals)
// ══════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[ERROR]', new Date().toISOString(), err.message);
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Sesión inválida.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Payload demasiado grande.' });
  }
  // Never expose internal error details
  res.status(500).json({ success: false, message: 'Error interno del servidor.' });
});

// ══════════════════════════════════════
// START SERVER
// ══════════════════════════════════════
const db = require('./config/database');

const server = app.listen(PORT, async () => {
  console.log(`\n🍎 =========================================`);
  console.log(`   Farmacias Peruanas - Suministros`);
  console.log(`   Puerto: ${PORT}`);
  console.log(`   Seguridad: Helmet + Rate Limit + CORS`);
  console.log(`=========================================\n`);

  try {
    const connection = await db.getConnection();
    console.log('✅ MySQL conectado.');
    connection.release();
  } catch (err) {
    console.error('❌ Error MySQL:', err.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = PORT + 1;
    console.log(`⚠️  Puerto ${PORT} ocupado. Intentando puerto ${nextPort}...`);
    server.listen(nextPort, async () => {
      console.log(`\n🍎 =========================================`);
      console.log(`   Farmacias Peruanas - Suministros`);
      console.log(`   Puerto: ${nextPort}`);
      console.log(`   Seguridad: Helmet + Rate Limit + CORS`);
      console.log(`=========================================\n`);
      try {
        const connection = await db.getConnection();
        console.log('✅ MySQL conectado.');
        connection.release();
      } catch (e) {
        console.error('❌ Error MySQL:', e.message);
      }
    });
  } else {
    console.error('❌ Error del servidor:', err.message);
  }
});
