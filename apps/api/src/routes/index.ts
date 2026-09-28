

import { Router } from 'express';
import healthRoutes from './health.routes';
import emailSearchRoutes from './email-search.routes';
import authRoutes from './auth.routes';
import slackRoutes from './slack.routes';
import campaignRoutes, { emailListRoutes, senderRoutes } from './campaign.routes';
import contactRoutes from './contact.routes';
import templateRoutes from './template.routes';
import suppressionRoutes from './suppression.routes';
import failureRoutes from './failure.routes';
import onboardingRoutes from './onboarding.routes';
import { bullBoardRouter, queueMetricsRouter } from './admin-queues.routes';

const router = Router();

router.use('/', healthRoutes);
router.use('/api', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/slack', slackRoutes);
router.use('/api/emails', emailSearchRoutes);
router.use('/api/emails', emailListRoutes);
router.use('/api/campaigns', campaignRoutes);
router.use('/api/contacts', contactRoutes);
router.use('/api/templates', templateRoutes);
router.use('/api/suppressions', suppressionRoutes);
router.use('/api/failures', failureRoutes);
router.use('/api/senders', senderRoutes);
router.use('/api/onboarding', onboardingRoutes);
router.use('/admin/queues', bullBoardRouter);
router.use('/api/admin/queues', queueMetricsRouter);

export default router;

