import { Router } from 'express';
import {
  connectSlack,
  slackCallback,
  getSlackStatus,
  disconnectSlack,
} from '../controllers/slack.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// GET /api/slack/connect
router.get('/connect', requireAuth, connectSlack);

// GET /api/slack/callback
router.get('/callback', requireAuth, slackCallback);

// GET /api/slack/status
router.get('/status', requireAuth, getSlackStatus);

// POST /api/slack/disconnect
router.post('/disconnect', requireAuth, disconnectSlack);

export default router;
