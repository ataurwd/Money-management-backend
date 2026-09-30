import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'LENT' | 'BORROWED';
export type TransactionStatus = 'PENDING' | 'PARTIAL' | 'SETTLED';

export interface IPayment {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  date: Date;
  note?: string;
  recordedAt: Date;
}

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  contactName: string;
  contactPhone?: string;
  type: TransactionType; // LENT = "You'll Get" (Ami Pai), BORROWED = "You'll Give" (Amr Kache Pai)
  totalAmount: number;
  remainingAmount: number;
  status: TransactionStatus;
  category: string;
  dueDate?: Date;
  notes?: string;
  payments: IPayment[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Payment amount must be greater than zero'],
  },
  date: {
    type: Date,
    default: Date.now,
  },
  note: {
    type: String,
    trim: true,
    default: '',
  },
  recordedAt: {
    type: Date,
    default: Date.now,
  },
});

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactName: {
      type: String,
      required: [true, 'Person/Contact name is required'],
      trim: true,
      index: true,
    },
    contactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: ['LENT', 'BORROWED'],
      index: true,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'SETTLED'],
      default: 'PENDING',
      index: true,
    },
    category: {
      type: String,
      default: 'General',
      enum: [
        'General',
        'Personal Loan',
        'Friend & Family',
        'Business',
        'Food & Dining',
        'Emergency',
        'Shopping',
        'Rent & Bills',
        'Travel',
        'Other',
      ],
    },
    dueDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    payments: [PaymentSchema],
  },
  {
    timestamps: true,
  }
);

// Helper method or pre-save to maintain status & remainingAmount integrity
TransactionSchema.pre<ITransaction>('save', function (next) {
  const totalPaid = (this.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
  const remaining = Math.max(0, this.totalAmount - totalPaid);
  this.remainingAmount = Math.round(remaining * 100) / 100;

  if (this.remainingAmount <= 0) {
    this.status = 'SETTLED';
  } else if (totalPaid > 0) {
    this.status = 'PARTIAL';
  } else {
    this.status = 'PENDING';
  }
  next();
});

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
