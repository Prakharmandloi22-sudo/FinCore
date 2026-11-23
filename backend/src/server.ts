import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';

const server = app.listen(config.port, () => {
  logger.info(`FinCore Business REST API running on port ${config.port} [${config.env}]`);
  logger.info(`Healthcheck available at http://localhost:${config.port}/health`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Gracefully shutting down FinCore server...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forcefully terminating process after 10s timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

