import { Router } from 'express';
import { suppressionController } from '../controllers/suppression.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', suppressionController.list);
router.post('/', suppressionController.create);
router.delete('/:id', suppressionController.delete);
router.delete('/by-email/:email', suppressionController.deleteByEmail);

export default router;
