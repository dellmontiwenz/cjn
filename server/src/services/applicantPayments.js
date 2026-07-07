const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPaymentDate(paidAt) {
  if (!datePattern.test(paidAt)) {
    return false;
  }

  const [year, month, day] = paidAt.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
}

export function parseMoneyAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

export function toPlainPayment(payment) {
  if (!payment) {
    return { totalFees: 0, entries: [] };
  }

  if (typeof payment.toObject === 'function') {
    return payment.toObject();
  }

  return {
    totalFees: payment.totalFees || 0,
    entries: Array.isArray(payment.entries) ? payment.entries : [],
  };
}

export function serializePaymentEntry(entry) {
  return {
    id: entry._id?.toString?.() || entry.id || '',
    paidAt: entry.paidAt || '',
    amount: Number(entry.amount) || 0,
    recordedAt: entry.recordedAt || '',
  };
}

export function serializePayment(payment) {
  const plainPayment = toPlainPayment(payment);
  const totalFees = Number(plainPayment.totalFees) || 0;
  const entries = (plainPayment.entries || [])
    .map(serializePaymentEntry)
    .sort((left, right) => right.paidAt.localeCompare(left.paidAt));
  const totalPaid = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const balance = Math.round((totalFees - totalPaid) * 100) / 100;

  return {
    totalFees,
    entries,
    totalPaid: Math.round(totalPaid * 100) / 100,
    balance,
  };
}
