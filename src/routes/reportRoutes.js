import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', reportController.list);
router.post('/', reportController.create);
router.get('/stats', reportController.stats);
router.get('/:id', reportController.detail);
router.put('/:id', reportController.update);
router.delete('/:id', reportController.remove);
router.patch('/:id/status', authorize('admin'), reportController.changeStatus);
router.post('/:id/notes', authorize('admin'), reportController.addNote);

export default router;
