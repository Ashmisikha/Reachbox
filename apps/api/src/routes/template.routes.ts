import { Router } from 'express';
import { templateController } from '../controllers/template.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// All template routes require authentication
router.use(requireAuth);

router.get('/', templateController.list);
router.post('/', templateController.create);
router.post('/preview', templateController.preview);
router.get('/:id', templateController.getById);
router.patch('/:id', templateController.update);
router.delete('/:id', templateController.delete);
router.post('/:id/duplicate', templateController.duplicate);

export default router;
