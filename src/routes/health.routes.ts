import { Router } from 'express';
import { getDepsStatus } from '../infra/deps';

const router = Router();

/**
 * Health endpoint for load balancers / uptime checks.
 * Returns 200 if the process is running.
 *
 * NOTE: This does not check DB/Redis connectivity.
 * If you want readiness checks later, add /ready.
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'file-drive-api',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe: dependencies are reachable.
 * - Redis can be optional in local/dev.
 */
router.get('/ready', (_req, res) => {
  const deps = getDepsStatus();
  const nodeEnv = process.env.NODE_ENV ?? 'production';

  const redisOptional = nodeEnv === 'local' || nodeEnv === 'development';

  const ready =
    deps.mongo === true &&
    (redisOptional ? true : deps.redis === true);

  const payload = {
    ready,       // what your tests expect
    ok: ready,   // backward-compatible alias
    deps: {
      mongo: deps.mongo,
      redis: deps.redis,
    },
    redisOptional,
  };

  return res.status(ready ? 200 : 503).json(payload);
});

export default router;