import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createCampaignHandler,
  listCampaignsHandler,
  getCampaignHandler,
  cancelCampaignHandler,
  campaignEventsHandler,
  senderHealthHandler,
  dashboardStatsHandler,
  scheduledEmailsHandler,
  sentEmailsHandler,
  listSendersHandler,
  createSenderHandler,
} from '../controllers/campaign.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Dashboard stats
router.get('/stats', dashboardStatsHandler);

// Campaign CRUD
router.post('/', createCampaignHandler);
router.get('/', listCampaignsHandler);
router.get('/:id', getCampaignHandler);
router.post('/:id/cancel', cancelCampaignHandler);
router.get('/:id/events', campaignEventsHandler);

export default router;

// Separate email-specific routes exported for the email router
export const emailListRoutes = Router();
emailListRoutes.use(requireAuth);
emailListRoutes.get('/scheduled', scheduledEmailsHandler);
emailListRoutes.get('/sent', sentEmailsHandler);

// Sender listing and creation route
export const senderRoutes = Router();
senderRoutes.use(requireAuth);
senderRoutes.get('/', listSendersHandler);
senderRoutes.post('/', createSenderHandler);
senderRoutes.get('/health', senderHealthHandler);

