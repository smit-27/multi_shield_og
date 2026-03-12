const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  res.json({ policies: queryAll('SELECT * FROM policies ORDER BY category, name') });
});

router.get('/:id', (req, res) => {
  const policy = queryOne('SELECT * FROM policies WHERE id = ?', [req.params.id]);
  if (!policy) return res.status(404).json({ error: 'Not found' });
  res.json({ policy });
});

router.post('/', (req, res) => {
  const { name, category, rule_type, threshold, value, description } = req.body;
  if (!name || !category || !rule_type) return res.status(400).json({ error: 'name, category, rule_type required' });
  const id = `POL_${uuidv4().slice(0, 6).toUpperCase()}`;
  runSql("INSERT INTO policies (id,name,category,rule_type,threshold,value,description) VALUES (?,?,?,?,?,?,?)",
    [id, name, category, rule_type, threshold || 0, value, description || '']);
  res.json({ success: true, id });
});

router.put('/:id', (req, res) => {
  const { name, category, rule_type, threshold, value, enabled, description } = req.body;
  const existing = queryOne('SELECT * FROM policies WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  runSql("UPDATE policies SET name=?,category=?,rule_type=?,threshold=?,value=?,enabled=?,description=?,updated_at=datetime('now') WHERE id=?",
    [name || existing.name, category || existing.category, rule_type || existing.rule_type,
     threshold != null ? threshold : existing.threshold, value !== undefined ? value : existing.value,
     enabled != null ? enabled : existing.enabled, description || existing.description, req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  runSql('DELETE FROM policies WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
