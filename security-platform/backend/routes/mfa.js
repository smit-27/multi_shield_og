/**
 * MFA Challenge Routes — handles multi-factor authentication workflow
 */
const express = require('express');
const router = express.Router();
const { queryOne, runSql } = require('../db');

// GET /api/mfa/active/codes — List all pending MFA challenges with OTP codes (admin use)
// IMPORTANT: This must be BEFORE /:challengeId to avoid Express treating 'active' as a param
router.get('/active/codes', (req, res) => {
  const { queryAll } = require('../db');
  const challenges = queryAll(
    "SELECT id, user_id, username, role, action, amount, risk_score, step, otp_code, created_at FROM mfa_challenges WHERE status='pending' ORDER BY created_at DESC"
  ) || [];
  res.json({ challenges });
});

// GET /api/mfa/:challengeId — Get challenge status
router.get('/:challengeId', (req, res) => {
  const challenge = queryOne('SELECT * FROM mfa_challenges WHERE id = ?', [req.params.challengeId]);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

  res.json({
    id: challenge.id,
    user_id: challenge.user_id,
    username: challenge.username,
    role: challenge.role,
    action: challenge.action,
    amount: challenge.amount,
    risk_score: challenge.risk_score,
    status: challenge.status,
    step: challenge.step,
    attempts: challenge.attempts,
    created_at: challenge.created_at,
    completed_at: challenge.completed_at
  });
});

// POST /api/mfa/:challengeId/verify — Verify current MFA step
router.post('/:challengeId/verify', (req, res) => {
  const challenge = queryOne('SELECT * FROM mfa_challenges WHERE id = ?', [req.params.challengeId]);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

  if (challenge.status === 'completed') {
    return res.json({ success: true, status: 'completed', message: 'MFA already completed' });
  }
  if (challenge.status === 'failed') {
    return res.status(403).json({ success: false, status: 'failed', message: 'MFA challenge has failed. Escalated to admin.' });
  }

  const { value } = req.body;
  const currentStep = challenge.step;
  let verified = false;

  switch (currentStep) {
    case 0: // Employee ID
      verified = value && value === challenge.user_id;
      break;
    case 1: // Password
      // Static mock: accept 'pass123' (matches demo accounts) or 'mfa_verify'
      verified = value === 'pass123' || value === 'mfa_verify';
      break;
    case 2: // Face Recognition — only pass if frontend explicitly confirmed a match
      verified = (value === 'face_verified');
      break;
    case 3: // OTP
      verified = value === challenge.otp_code;
      break;
    default:
      return res.status(400).json({ error: 'Invalid step' });
  }

  if (verified) {
    const nextStep = currentStep + 1;
    
    if (nextStep >= 4) {
      // All steps passed — mark completed
      runSql("UPDATE mfa_challenges SET status='completed', step=?, completed_at=datetime('now') WHERE id=?",
        [nextStep, challenge.id]);
      
      // Also resolve the linked incident
      if (challenge.incident_id) {
        runSql("UPDATE incidents SET status='resolved', resolution='MFA completed successfully', resolved_by=?, resolved_at=datetime('now') WHERE id=?",
          [challenge.user_id, challenge.incident_id]);
      }

      runSql("INSERT INTO audit_log (event_type, details, performed_by) VALUES ('mfa_completed', ?, ?)",
        [JSON.stringify({ challenge_id: challenge.id, user_id: challenge.user_id }), challenge.user_id]);

      return res.json({ success: true, status: 'completed', step: nextStep, message: 'MFA completed successfully! You may return to the banking system.' });
    }

    // Move to next step
    runSql("UPDATE mfa_challenges SET step=? WHERE id=?", [nextStep, challenge.id]);
    
    const response = { success: true, status: 'pending', step: nextStep, message: 'Step verified' };

    // OTP is NOT sent to the MFA page — admin must read it from the admin portal
    if (nextStep === 3) {
      response.message = 'Face verified. Enter the hexadecimal OTP code from your admin portal.';
    }

    return res.json(response);
  }

  // Verification failed
  let newAttempts = challenge.attempts + 1;
  
  // Force immediate failure on face recognition mismatch
  if (value === 'face_failed') {
    newAttempts = 3;
  }
  
  if (newAttempts >= 3) {
    // Too many failures — escalate to admin approval
    runSql("UPDATE mfa_challenges SET status='failed', attempts=? WHERE id=?", [newAttempts, challenge.id]);

    // Create admin approval request (escalation)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const approvalResult = runSql(
      "INSERT INTO approval_requests (incident_id, user_id, username, role, action, amount, risk_score, status, expires_at, user_message) VALUES (?,?,?,?,?,?,?,'pending',?,?)",
      [challenge.incident_id, challenge.user_id, challenge.username, challenge.role,
       challenge.action, challenge.amount, challenge.risk_score, expiresAt,
       'MFA verification failed — automatic escalation']
    );

    runSql("INSERT INTO audit_log (event_type, details, performed_by) VALUES ('mfa_failed_escalated', ?, 'system')",
      [JSON.stringify({ challenge_id: challenge.id, user_id: challenge.user_id, request_id: approvalResult.lastInsertRowid })]);

    return res.status(403).json({
      success: false,
      status: 'failed',
      message: 'MFA verification failed after 3 attempts. Your action has been escalated for admin approval.',
      escalated: true,
      request_id: approvalResult.lastInsertRowid
    });
  }

  runSql("UPDATE mfa_challenges SET attempts=? WHERE id=?", [newAttempts, challenge.id]);
  return res.status(401).json({
    success: false,
    status: 'pending',
    step: currentStep,
    attempts: newAttempts,
    remaining: 3 - newAttempts,
    message: `Verification failed. ${3 - newAttempts} attempt(s) remaining.`
  });
});

// GET /api/mfa/:challengeId/otp — Get OTP (for admin portal only)
router.get('/:challengeId/otp', (req, res) => {
  const challenge = queryOne('SELECT otp_code FROM mfa_challenges WHERE id = ?', [req.params.challengeId]);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
  res.json({ otp: challenge.otp_code });
});


module.exports = router;
