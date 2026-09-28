import { Router } from 'express';
import healthRoutes from './health.routes';
import emailSearchRoutes from './email-search.routes';
import authRoutes from './auth.routes';

const router = Router();

router.use('/', healthRoutes);
router.use('/api', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/emails', emailSearchRoutes);

export default router;
