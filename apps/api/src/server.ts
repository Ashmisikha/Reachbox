import { app } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { closeDb } from './lib/db';
import { closeRedis } from './lib/redis';

const server = app.listen(config.API_PORT, config.API_HOST, () => {
  logger.info(`ReachInbox API server running`, {
    host: config.API_HOST,
    port: config.API_PORT,
    environment: config.NODE_ENV,
    url: `http://${config.API_HOST === '0.0.0.0' ? 'localhost' : config.API_HOST}:${config.API_PORT}`,
  });
});

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      logger.error('Error during HTTP server close', { error: err.message });
      process.exit(1);
    }

    try {
      await Promise.allSettled([closeDb(), closeRedis()]);
      logger.info('Database and Redis connections closed successfully');
      process.exit(0);
    } catch (cleanupError) {
      logger.error('Error during cleanup', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
      process.exit(1);
    }
  });

  // Force close after 10s timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;
