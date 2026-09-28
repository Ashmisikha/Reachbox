import { Router } from 'express';
import healthRoutes from './health.routes';
import emailSearchRoutes from './email-search.routes';
import authRoutes from './auth.routes';
import slackRoutes from './slack.routes';
import campaignRoutes, { emailListRoutes, senderRoutes } from './campaign.routes';
import { bullBoardRouter, queueMetricsRouter } from './admin-queues.routes';

const router = Router();

router.use('/', healthRoutes);
router.use('/api', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/slack', slackRoutes);
router.use('/api/emails', emailSearchRoutes);
router.use('/api/emails', emailListRoutes);
router.use('/api/campaigns', campaignRoutes);
router.use('/api/senders', senderRoutes);
router.use('/admin/queues', bullBoardRouter);
router.use('/api/admin/queues', queueMetricsRouter);

export default router;

