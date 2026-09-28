import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  listContactsHandler,
  createContactHandler,
  getContactHandler,
  updateContactHandler,
  deleteContactHandler,
  bulkDeleteContactsHandler,
  getContactTagsHandler,
  importContactsCsvHandler,
} from '../controllers/contact.controller';

const router = Router();

// All contact routes require active user authentication
router.use(requireAuth);

router.get('/tags', getContactTagsHandler);
router.post('/import', importContactsCsvHandler);
router.post('/bulk-delete', bulkDeleteContactsHandler);

router.get('/', listContactsHandler);
router.post('/', createContactHandler);
router.get('/:id', getContactHandler);
router.patch('/:id', updateContactHandler);
router.delete('/:id', deleteContactHandler);

export default router;
