import { Router } from 'express';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  addPayment,
  deletePayment,
  settleInFull,
} from '../controllers/transactionController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getTransactions);
router.post('/', createTransaction);
router.get('/:id', getTransactionById);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);
router.post('/:id/payments', addPayment);
router.delete('/:id/payments/:paymentId', deletePayment);
router.post('/:id/settle', settleInFull);

export default router;
