const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use((req, res, next) => {
  console.log(`[BANKING] ${req.method} ${req.path}`);
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

async function start() {
  await initDb();

  const { router: authRouter, authMiddleware } = require('./routes/auth');
  const treasuryRouter = require('./routes/treasury');
  const loansRouter = require('./routes/loans');
  const customersRouter = require('./routes/customers');
  const { queryAll } = require('./db');

  app.use('/api/auth', authRouter);
  app.use('/api/treasury', authMiddleware, treasuryRouter);
  app.use('/api/loans', authMiddleware, loansRouter);
  app.use('/api/customers', authMiddleware, customersRouter);

  app.get('/api/activity-logs', authMiddleware, (req, res) => {
    const { limit = 50 } = req.query;
    res.json({ logs: queryAll('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?', [parseInt(limit)]) });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'dummy-banking-system', timestamp: new Date().toISOString() });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏦 Dummy Banking System API running on http://0.0.0.0:${PORT}`);
  });
}

start().catch(console.error);
