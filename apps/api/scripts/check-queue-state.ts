import { Queue } from 'bullmq';
import { bullmqRedis } from '../src/queues/redis';
import { EMAIL_QUEUE_NAME } from '../src/queues/email.queue';

async function main() {
  const queue = new Queue(EMAIL_QUEUE_NAME, { connection: bullmqRedis });

  const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
  console.log('QUEUE_COUNTS:', counts);

  const delayedJobs = await queue.getDelayed(0, 10);
  console.log('DELAYED_JOBS:', delayedJobs.map(j => ({ id: j.id, name: j.name, data: j.data, delay: j.opts.delay, timestamp: j.timestamp })));

  const waitingJobs = await queue.getWaiting(0, 10);
  console.log('WAITING_JOBS:', waitingJobs.map(j => ({ id: j.id, name: j.name, data: j.data })));

  const failedJobs = await queue.getFailed(0, 10);
  console.log('FAILED_JOBS:', failedJobs.map(j => ({ id: j.id, failedReason: j.failedReason, data: j.data })));

  const completedJobs = await queue.getCompleted(0, 10);
  console.log('COMPLETED_JOBS:', completedJobs.map(j => ({ id: j.id, name: j.name, data: j.data })));

  await queue.close();
}

main().catch(console.error).finally(() => bullmqRedis.quit());
