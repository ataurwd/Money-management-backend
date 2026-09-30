import { Response } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';

export const getContactsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user?.userId);

    const contactsData = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$contactName',
          phone: { $first: '$contactPhone' },
          totalLent: {
            $sum: {
              $cond: [{ $eq: ['$type', 'LENT'] }, '$totalAmount', 0],
            },
          },
          pendingLent: {
            $sum: {
              $cond: [{ $eq: ['$type', 'LENT'] }, '$remainingAmount', 0],
            },
          },
          totalBorrowed: {
            $sum: {
              $cond: [{ $eq: ['$type', 'BORROWED'] }, '$totalAmount', 0],
            },
          },
          pendingBorrowed: {
            $sum: {
              $cond: [{ $eq: ['$type', 'BORROWED'] }, '$remainingAmount', 0],
            },
          },
          transactionCount: { $sum: 1 },
          settledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'SETTLED'] }, 1, 0] },
          },
          lastActivity: { $max: '$updatedAt' },
        },
      },
      { $sort: { pendingLent: -1, pendingBorrowed: -1 } },
    ]);

    const result = contactsData.map((c) => {
      const net = c.pendingLent - c.pendingBorrowed;
      let statusLabel = 'Settled';
      if (net > 0) statusLabel = 'Owes You';
      else if (net < 0) statusLabel = 'You Owe';

      return {
        name: c._id,
        phone: c.phone || '',
        totalLent: c.totalLent,
        pendingLent: c.pendingLent,
        totalBorrowed: c.totalBorrowed,
        pendingBorrowed: c.pendingBorrowed,
        netBalance: net, // > 0 means they owe you; < 0 means you owe them
        statusLabel,
        transactionCount: c.transactionCount,
        settledCount: c.settledCount,
        lastActivity: c.lastActivity,
      };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Contacts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch contacts ledger.' });
  }
};
