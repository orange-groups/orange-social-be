import { Logger } from '@nestjs/common';
import type { RequestHandler } from 'express';

export function createHttpRequestLogger(
  logger: Pick<Logger, 'log'> = new Logger('HTTP'),
): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();
    // Exclude query strings, which can contain password-reset tokens.
    const path = JSON.stringify(req.originalUrl.split('?')[0]);

    const logRequest = () => {
      res.off('finish', logRequest);
      res.off('close', logRequest);
      const duration = (performance.now() - startedAt).toFixed(1);
      const status = res.writableFinished ? res.statusCode : 'ABORTED';
      logger.log(`${req.method} ${path} ${status} ${duration}ms`);
    };

    res.once('finish', logRequest);
    res.once('close', logRequest);
    next();
  };
}
