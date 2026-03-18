const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use((req, res, next) => {
  console.log(`[ZTA GW] ${req.method} ${req.path}`);
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

async function start() {
  await initDb();

  // ─── ZTA Middleware ───
  const { verifyJwt } = require('./middleware/keycloak');

  // ─── ZTA Gateway Routes (public — no JWT required for /login) ───
  app.use('/api/zta', require('./routes/ztaGateway'));

  // ─── Existing Security Platform Routes (unchanged) ───
  app.use('/api/analyze', require('./routes/analyze'));
  app.use('/api/policies', require('./routes/policies'));
  app.use('/api/incidents', require('./routes/incidents'));
  app.use('/api/activities', require('./routes/activities'));
  app.use('/api/mfa', require('./routes/mfa'));
  app.use('/api/approvals', require('./routes/approvals'));

  // ─── ZTA Banking Proxy (JWT required) ───
  // All /api/banking/* requests are proxied to dummy-banking after ZTA verification
  app.use('/api/banking', verifyJwt, require('./routes/bankingProxy'));

  // ─── Health Check ───
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'security-platform',
      zta_gateway: 'active',
      timestamp: new Date().toISOString()
    });
  });

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`🛡️  Security Platform (ZTA Gateway) running on http://127.0.0.1:${PORT}`);
    console.log(`   ZTA Auth:    POST http://127.0.0.1:${PORT}/api/zta/login`);
    console.log(`   Banking:     /api/banking/* → http://127.0.0.1:3001/api/*`);
    console.log(`   MFA:         /api/mfa/*`);
    console.log(`   Analyze:     POST /api/analyze`);
  });
}

start().catch(console.error);
