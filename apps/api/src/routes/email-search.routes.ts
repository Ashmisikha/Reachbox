import { Router } from 'express';
import { searchEmails } from '../controllers/email-search.controller';

const router = Router();

// GET /api/emails/search
router.get('/search', searchEmails);

export default router;
