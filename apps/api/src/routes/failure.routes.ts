import { Router } from 'express';
import { failureController } from '../controllers/failure.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', failureController.list);
router.post('/retry-all', failureController.retryAll);
router.post('/retry-selected', failureController.retrySelected);
router.post('/:id/retry', failureController.retrySingle);

export default router;
