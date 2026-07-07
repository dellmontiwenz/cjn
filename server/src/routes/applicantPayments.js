import {
  isValidPaymentDate,
  parseMoneyAmount,
  serializePayment,
  toPlainPayment,
} from '../services/applicantPayments.js';
import { exportApplicantPaymentsToWord } from '../services/applicantPaymentWordExport.js';
import { validateAdministrationPassword } from '../config/admin.js';

function getPaymentValidationError({ totalFees, paidAt, amount }) {
  if (totalFees !== undefined) {
    const parsedTotalFees = parseMoneyAmount(totalFees);
    if (parsedTotalFees === null) {
      return 'Total fees must be a valid amount of 0 or greater';
    }
  }

  if (paidAt !== undefined || amount !== undefined) {
    if (!paidAt || !isValidPaymentDate(String(paidAt).trim())) {
      return 'Please enter a valid payment date';
    }

    const parsedAmount = parseMoneyAmount(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      return 'Payment amount must be greater than 0';
    }
  }

  return null;
}

function rejectInvalidAdminPassword(req, res) {
  const adminPassword = String(req.body?.adminPassword || '');
  const validationError = validateAdministrationPassword(adminPassword);

  if (!validationError) {
    return false;
  }

  const status = validationError.includes('not configured')
    ? 503
    : validationError.includes('Invalid')
      ? 403
      : 400;
  res.status(status).json({ message: validationError });
  return true;
}

export function registerApplicantPaymentRoutes(applicantsRouter, applicantModel, documentStorage = null) {
  applicantsRouter.get('/:id/payments', async (req, res, next) => {
    try {
      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      return res.json({ payment: serializePayment(applicant.payment) });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.put('/:id/payments/total-fees', async (req, res, next) => {
    try {
      const validationError = getPaymentValidationError({ totalFees: req.body.totalFees });
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const currentPayment = toPlainPayment(applicant.payment);
      const updatedApplicant = await applicantModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            payment: {
              ...currentPayment,
              totalFees: parseMoneyAmount(req.body.totalFees),
            },
          },
        },
        { returnDocument: 'after' },
      );

      return res.json({ payment: serializePayment(updatedApplicant.payment) });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.post('/:id/payments/entries', async (req, res, next) => {
    try {
      const paidAt = String(req.body.paidAt || '').trim();
      const validationError = getPaymentValidationError({
        paidAt,
        amount: req.body.amount,
      });

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const currentPayment = toPlainPayment(applicant.payment);
      const entry = {
        paidAt,
        amount: parseMoneyAmount(req.body.amount),
        recordedAt: new Date().toISOString(),
      };

      const updatedApplicant = await applicantModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            payment: {
              totalFees: Number(currentPayment.totalFees) || 0,
              entries: [...(currentPayment.entries || []), entry],
            },
          },
        },
        { returnDocument: 'after' },
      );

      return res.status(201).json({ payment: serializePayment(updatedApplicant.payment) });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.delete('/:id/payments/history', async (req, res, next) => {
    try {
      if (rejectInvalidAdminPassword(req, res)) {
        return undefined;
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const updatedApplicant = await applicantModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            payment: {
              totalFees: 0,
              entries: [],
            },
          },
        },
        { returnDocument: 'after' },
      );

      return res.json({ payment: serializePayment(updatedApplicant.payment) });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.post('/:id/payments/export/word', async (req, res, next) => {
    try {
      if (!documentStorage?.isConfigured) {
        return res.status(503).json({
          message: 'Document storage is not configured on the server.',
        });
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const { buffer, fileName, relativePath } = await exportApplicantPaymentsToWord(applicant, documentStorage);
      const safeFileName = fileName.replace(/"/g, '');
      const encodedFileName = encodeURIComponent(safeFileName);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
      );
      res.setHeader('X-CJN-Filename', safeFileName);
      res.setHeader('X-CJN-Saved-Path', relativePath);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.delete('/:id/payments/entries/:entryId', async (req, res, next) => {
    try {
      if (rejectInvalidAdminPassword(req, res)) {
        return undefined;
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const currentPayment = toPlainPayment(applicant.payment);
      const nextEntries = (currentPayment.entries || []).filter((entry) => {
        const entryId = entry._id?.toString?.() || entry.id;
        return entryId !== req.params.entryId;
      });

      if (nextEntries.length === (currentPayment.entries || []).length) {
        return res.status(404).json({ message: 'Payment entry not found' });
      }

      const updatedApplicant = await applicantModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            payment: {
              totalFees: Number(currentPayment.totalFees) || 0,
              entries: nextEntries,
            },
          },
        },
        { returnDocument: 'after' },
      );

      return res.json({ payment: serializePayment(updatedApplicant.payment) });
    } catch (error) {
      return next(error);
    }
  });
}
