import { Router, Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { requireAuth } from '../middleware/auth.middleware';
import { emailQueue } from '../queues/email.queue';
import { emailIndexQueue } from '../queues/email-index.queue';
import { slackNotificationQueue } from '../queues/slack-notification.queue';
import { queueConfig } from '../config/queue';

// ─── 1. Bull-Board Express Adapter ──────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue, { readOnlyMode: false }),
    new BullMQAdapter(emailIndexQueue, { readOnlyMode: false }),
    new BullMQAdapter(slackNotificationQueue, { readOnlyMode: false }),
  ],
  serverAdapter,
});

export const bullBoardRouter = Router();

// Strictly protected by existing authenticated session (no unauthenticated access)
bullBoardRouter.use(requireAuth, serverAdapter.getRouter());

// ─── 2. JSON Metrics Endpoint for Dashboard Consumption ──────────────────────
export const queueMetricsRouter = Router();
queueMetricsRouter.use(requireAuth);

queueMetricsRouter.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [dispatchCounts, indexCounts, slackCounts] = await Promise.all([
      emailQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
      emailIndexQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
      slackNotificationQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
    ]);

    const isDispatchPaused = await emailQueue.isPaused();
    const isIndexPaused = await emailIndexQueue.isPaused();
    const isSlackPaused = await slackNotificationQueue.isPaused();

    res.status(200).json({
      timestamp: new Date().toISOString(),
      workerConcurrency: queueConfig.workerConcurrency,
      queues: [
        {
          name: 'email-dispatch',
          displayName: 'Email Dispatch Queue',
          description: 'BullMQ delayed jobs for deterministic email sending',
          isPaused: isDispatchPaused,
          counts: dispatchCounts,
        },
        {
          name: 'email-index',
          displayName: 'Elasticsearch Indexing Queue',
          description: 'Decoupled async indexing projection into Elasticsearch',
          isPaused: isIndexPaused,
          counts: indexCounts,
        },
        {
          name: 'slack-notification',
          displayName: 'Slack Notification Queue',
          description: 'Rate-limit alert dispatch with atomic deduplication',
          isPaused: isSlackPaused,
          counts: slackCounts,
        },
      ],
    });
  } catch (error) {
    next(error);
  }
});
