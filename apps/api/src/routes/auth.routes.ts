import { Router } from 'express';
import {
  startGoogleAuth,
  googleCallback,
  getMe,
  logout,
  emailAuth,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/email
router.post('/email', emailAuth);

// GET /api/auth/google
router.get('/google', startGoogleAuth);

// GET /api/auth/google/callback
router.get('/google/callback', googleCallback);

// GET /api/auth/me
router.get('/me', requireAuth, getMe);

// POST /api/auth/logout
router.post('/logout', logout);

export default router;
