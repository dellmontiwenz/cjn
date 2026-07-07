import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { serializePayment } from './applicantPayments.js';
import { applicantFolderName } from './documentStorage.js';

function formatMoney(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatPaymentDate(paidAt) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paidAt || '');
  if (!match) {
    return paidAt || '';
  }

  const [, year, month, day] = match;
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(localDate.getTime())) {
    return paidAt;
  }

  return localDate.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function paragraph(text, { bold = false, heading = null, italics = false } = {}) {
  return new Paragraph({
    ...(heading ? { heading } : {}),
    children: [
      new TextRun({
        text,
        bold,
        italics,
      }),
    ],
  });
}

function labeledParagraph(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun(String(value)),
    ],
  });
}

function tableHeaderCell(text) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true })],
      }),
    ],
  });
}

function tableCell(text) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun(String(text))] })],
  });
}

function buildPaymentHistoryTable(entries) {
  const rows = [
    new TableRow({
      children: [tableHeaderCell('Payment Date'), tableHeaderCell('Amount')],
    }),
    ...entries.map(
      (entry) =>
        new TableRow({
          children: [tableCell(formatPaymentDate(entry.paidAt)), tableCell(formatMoney(entry.amount))],
        }),
    ),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

export async function buildApplicantPaymentWordDocument(applicant) {
  const fullName = applicantFolderName(applicant);
  const payment = serializePayment(applicant.payment);
  const children = [];

  children.push(paragraph('Payment Details', { bold: true, heading: HeadingLevel.HEADING_1 }));
  children.push(paragraph(fullName, { bold: true, heading: HeadingLevel.HEADING_2 }));
  children.push(paragraph('Summary', { bold: true, heading: HeadingLevel.HEADING_2 }));
  children.push(labeledParagraph('Total Fees', formatMoney(payment.totalFees)));
  children.push(labeledParagraph('Total Payment', formatMoney(payment.totalPaid)));
  children.push(labeledParagraph('Balance', formatMoney(payment.balance)));
  children.push(paragraph('Payment History', { bold: true, heading: HeadingLevel.HEADING_2 }));

  if (payment.entries.length === 0) {
    children.push(paragraph('No payments recorded yet.', { italics: true }));
  } else {
    children.push(buildPaymentHistoryTable(payment.entries));
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function exportApplicantPaymentsToWord(applicant, documentStorage) {
  if (!documentStorage?.isConfigured) {
    throw new Error('Document storage is not configured on the server.');
  }

  const folderPath = await documentStorage.ensureApplicantFolder(applicant);
  const fullName = applicantFolderName(applicant);
  const fileName = `${fullName} - Payments.docx`;
  const relativePath = `${folderPath}/${fileName}`;
  const buffer = await buildApplicantPaymentWordDocument(applicant);

  await documentStorage.saveFile(relativePath, buffer);

  return {
    buffer,
    fileName,
    relativePath,
  };
}
