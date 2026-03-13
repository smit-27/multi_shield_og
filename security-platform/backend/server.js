const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'], credentials: true }));
app.use(express.json());

async function start() {
  await initDb();

  app.use('/api/analyze', require('./routes/analyze'));
  app.use('/api/policies', require('./routes/policies'));
  app.use('/api/incidents', require('./routes/incidents'));
  app.use('/api/activities', require('./routes/activities'));
  app.use('/api/mfa', require('./routes/mfa'));
  app.use('/api/approvals', require('./routes/approvals'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'security-platform', timestamp: new Date().toISOString() });
  });

  app.listen(PORT, () => {
    console.log(`🛡️  Security Platform API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
