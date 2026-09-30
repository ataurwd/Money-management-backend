import { Response } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';

export const getDashboardSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user?.userId);

    // Aggregate statistics
    const stats = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$type',
          totalInitial: { $sum: '$totalAmount' },
          totalRemaining: { $sum: '$remainingAmount' },
          count: { $sum: 1 },
          settledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'SETTLED'] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $ne: ['$status', 'SETTLED'] }, 1, 0] },
          },
        },
      },
    ]);

    let lentTotal = 0;
    let lentRemaining = 0;
    let lentCount = 0;
    let lentSettled = 0;

    let borrowedTotal = 0;
    let borrowedRemaining = 0;
    let borrowedCount = 0;
    let borrowedSettled = 0;

    stats.forEach((s) => {
      if (s._id === 'LENT') {
        lentTotal = s.totalInitial;
        lentRemaining = s.totalRemaining;
        lentCount = s.count;
        lentSettled = s.settledCount;
      } else if (s._id === 'BORROWED') {
        borrowedTotal = s.totalInitial;
        borrowedRemaining = s.totalRemaining;
        borrowedCount = s.count;
        borrowedSettled = s.settledCount;
      }
    });

    const netBalance = lentRemaining - borrowedRemaining;

    // Check overdue transactions (status != SETTLED and dueDate < now)
    const now = new Date();
    const overdueTransactions = await Transaction.find({
      userId,
      status: { $ne: 'SETTLED' },
      dueDate: { $lt: now, $ne: null },
    })
      .sort({ dueDate: 1 })
      .limit(5);

    // Check upcoming transactions (status != SETTLED and dueDate between now and 7 days)
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);

    const upcomingTransactions = await Transaction.find({
      userId,
      status: { $ne: 'SETTLED' },
      dueDate: { $gte: now, $lte: next7Days },
    })
      .sort({ dueDate: 1 })
      .limit(5);

    // Top people who owe you (LENT)
    const topDebtors = await Transaction.aggregate([
      { $match: { userId, type: 'LENT', status: { $ne: 'SETTLED' } } },
      {
        $group: {
          _id: '$contactName',
          totalOwed: { $sum: '$remainingAmount' },
          phone: { $first: '$contactPhone' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalOwed: -1 } },
      { $limit: 5 },
    ]);

    // Top people you owe (BORROWED)
    const topCreditors = await Transaction.aggregate([
      { $match: { userId, type: 'BORROWED', status: { $ne: 'SETTLED' } } },
      {
        $group: {
          _id: '$contactName',
          totalIOwe: { $sum: '$remainingAmount' },
          phone: { $first: '$contactPhone' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalIOwe: -1 } },
      { $limit: 5 },
    ]);

    // Recent 6 transactions
    const recentTransactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          // Money people owe you (Ami Taka Pai)
          lent: {
            totalOriginal: lentTotal,
            totalPending: lentRemaining,
            totalCollected: lentTotal - lentRemaining,
            count: lentCount,
            settledCount: lentSettled,
          },
          // Money you owe others (Amr Kache Taka Pai)
          borrowed: {
            totalOriginal: borrowedTotal,
            totalPending: borrowedRemaining,
            totalRepaid: borrowedTotal - borrowedRemaining,
            count: borrowedCount,
            settledCount: borrowedSettled,
          },
          // Overall net
          netBalance, // Positive = You are in surplus; Negative = You are in deficit
          totalTransactions: lentCount + borrowedCount,
          totalSettled: lentSettled + borrowedSettled,
          totalActive: lentCount + borrowedCount - (lentSettled + borrowedSettled),
        },
        alerts: {
          overdueCount: overdueTransactions.length,
          overdueList: overdueTransactions,
          upcomingCount: upcomingTransactions.length,
          upcomingList: upcomingTransactions,
        },
        topDebtors: topDebtors.map((d) => ({
          name: d._id,
          amount: d.totalOwed,
          phone: d.phone,
          count: d.count,
        })),
        topCreditors: topCreditors.map((c) => ({
          name: c._id,
          amount: c.totalIOwe,
          phone: c.phone,
          count: c.count,
        })),
        recentTransactions,
      },
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch dashboard summary.' });
  }
};
