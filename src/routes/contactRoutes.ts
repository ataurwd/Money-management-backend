import { Router } from 'express';
import { getContactsSummary } from '../controllers/contactController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getContactsSummary);

export default router;
