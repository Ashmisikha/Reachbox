import { Router } from 'express';
import { searchEmails } from '../controllers/email-search.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// GET /api/emails/search (strictly protected by authenticated session)
router.get('/search', requireAuth, searchEmails);

export default router;

