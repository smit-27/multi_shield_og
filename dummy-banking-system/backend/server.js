const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'], credentials: true }));
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

  app.listen(PORT, () => {
    console.log(`🏦 Dummy Banking System API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
