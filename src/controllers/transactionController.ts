import { Response } from 'express';
import mongoose from 'mongoose';
import { Transaction, ITransaction, TransactionType, TransactionStatus } from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const {
      type,
      status,
      contactName,
      category,
      search,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query: any = { userId };

    if (type && (type === 'LENT' || type === 'BORROWED')) {
      query.type = type;
    }

    if (status && ['PENDING', 'PARTIAL', 'SETTLED'].includes(status as string)) {
      query.status = status;
    }

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (contactName) {
      query.contactName = { $regex: contactName, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { contactName: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { contactPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField = typeof sortBy === 'string' ? sortBy : 'createdAt';

    const transactions = await Transaction.find(query).sort({ [sortField]: sortOrder });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch transactions.' });
  }
};

export const getTransactionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
      return;
    }

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve transaction.' });
  }
};

export const createTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const {
      contactName,
      contactPhone,
      type,
      totalAmount,
      dueDate,
      category,
      notes,
      initialPayment,
    } = req.body;

    if (!contactName || !contactName.trim()) {
      res.status(400).json({ success: false, message: 'Contact / Person name is required.' });
      return;
    }

    if (!type || !['LENT', 'BORROWED'].includes(type)) {
      res.status(400).json({ success: false, message: 'Transaction type must be either LENT or BORROWED.' });
      return;
    }

    const numericAmount = Number(totalAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ success: false, message: 'Total amount must be greater than zero.' });
      return;
    }

    const payments: any[] = [];
    if (initialPayment && Number(initialPayment) > 0) {
      const initAmt = Math.min(Number(initialPayment), numericAmount);
      payments.push({
        amount: initAmt,
        date: new Date(),
        note: 'Initial partial payment',
        recordedAt: new Date(),
      });
    }

    const transaction = new Transaction({
      userId,
      contactName: contactName.trim(),
      contactPhone: contactPhone ? contactPhone.trim() : '',
      type,
      totalAmount: numericAmount,
      remainingAmount: numericAmount,
      category: category || 'General',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes ? notes.trim() : '',
      payments,
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: transaction,
    });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create transaction.' });
  }
};

export const updateTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { contactName, contactPhone, category, dueDate, notes, totalAmount } = req.body;

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    if (contactName) transaction.contactName = contactName.trim();
    if (contactPhone !== undefined) transaction.contactPhone = contactPhone.trim();
    if (category) transaction.category = category;
    if (dueDate !== undefined) transaction.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (notes !== undefined) transaction.notes = notes.trim();

    if (totalAmount !== undefined) {
      const newTotal = Number(totalAmount);
      if (isNaN(newTotal) || newTotal <= 0) {
        res.status(400).json({ success: false, message: 'Total amount must be greater than zero.' });
        return;
      }
      const totalPaid = transaction.payments.reduce((acc, p) => acc + p.amount, 0);
      if (newTotal < totalPaid) {
        res.status(400).json({
          success: false,
          message: `Cannot set total amount below already paid amount (${totalPaid}).`,
        });
        return;
      }
      transaction.totalAmount = newTotal;
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update transaction.' });
  }
};

export const deleteTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const transaction = await Transaction.findOneAndDelete({ _id: id, userId });
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Record deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete transaction.' });
  }
};

export const addPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { amount, date, note } = req.body;

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
      return;
    }

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    if (transaction.status === 'SETTLED' || transaction.remainingAmount <= 0) {
      res.status(400).json({ success: false, message: 'This transaction is already fully settled.' });
      return;
    }

    if (numericAmount > transaction.remainingAmount + 0.001) {
      res.status(400).json({
        success: false,
        message: `Payment amount (${numericAmount}) exceeds remaining balance (${transaction.remainingAmount}).`,
      });
      return;
    }

    transaction.payments.push({
      amount: numericAmount,
      date: date ? new Date(date) : new Date(),
      note: note ? note.trim() : 'Payment settlement installment',
      recordedAt: new Date(),
    });

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      data: transaction,
    });
  } catch (error: any) {
    console.error('Error adding payment:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to add payment.' });
  }
};

export const deletePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id, paymentId } = req.params;

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    const paymentIndex = transaction.payments.findIndex(
      (p) => p._id && p._id.toString() === paymentId
    );

    if (paymentIndex === -1) {
      res.status(404).json({ success: false, message: 'Payment entry not found.' });
      return;
    }

    transaction.payments.splice(paymentIndex, 1);
    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Payment removed successfully',
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to remove payment.' });
  }
};

export const settleInFull = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { note } = req.body;

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    if (transaction.remainingAmount <= 0) {
      res.status(400).json({ success: false, message: 'This transaction is already settled.' });
      return;
    }

    transaction.payments.push({
      amount: transaction.remainingAmount,
      date: new Date(),
      note: note ? note.trim() : 'One-click full settlement',
      recordedAt: new Date(),
    });

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Transaction settled in full successfully',
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to settle transaction.' });
  }
};
