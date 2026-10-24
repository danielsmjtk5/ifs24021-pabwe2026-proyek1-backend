import { Router } from 'express';
import { health } from '../controllers/healthController.js';
import authRoutes from './authRoutes.js';
import reportRoutes from './reportRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/reports', reportRoutes);

export default router;
