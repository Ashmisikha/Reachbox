import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getOnboardingStatus,
  saveSetup,
  saveTour,
  replayTour,
  resetSetup,
} from '../controllers/onboarding.controller';

const router = Router();

// Strictly enforce authentication for all onboarding routes
router.use(requireAuth);

// GET /api/onboarding/status
router.get('/status', getOnboardingStatus);

// POST /api/onboarding/setup
router.post('/setup', saveSetup);

// POST /api/onboarding/tour
router.post('/tour', saveTour);

// POST /api/onboarding/tour/replay
router.post('/tour/replay', replayTour);

// POST /api/onboarding/setup/reset
router.post('/setup/reset', resetSetup);

export default router;
