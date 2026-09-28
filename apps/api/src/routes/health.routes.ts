import { Router } from 'express';
import { getHealth, getElasticsearchHealthCheck } from '../controllers/health.controller';

const router = Router();

router.get('/health', getHealth);
router.get('/health/elasticsearch', getElasticsearchHealthCheck);

export default router;
