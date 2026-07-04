import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';
import { toPlainDocuments } from '../routes/applicantDocuments.js';
import { getDefaultAvatarPng } from './defaultAvatarPng.js';
import { applicantFolderName, documentTypes } from './documentStorage.js';
import { convertPdfToPngPages } from './pdfToPng.js';

const documentLabels = {
  tor: 'TOR',
  passport: 'Passport',
  hkid: 'HKID',
};

const maxEmbeddedWidth = 520;

function formatDateOfBirth(dateOfBirth) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth || '');
  if (!match) {
    return dateOfBirth || '';
  }

  const [, year, month, day] = match;
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(localDate.getTime())) {
    return dateOfBirth;
  }

  return localDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getExportFields(applicant) {
  const fields = [
    ['Maiden name', applicant.maidenName],
    [
      'Date of birth',
      applicant.dateOfBirth
        ? (() => {
            const formatted = formatDateOfBirth(applicant.dateOfBirth);
            const age = calculateAge(applicant.dateOfBirth);
            return age === null ? formatted : `${formatted} (age ${age})`;
          })()
        : '',
    ],
    ['Sex', applicant.sex],
    ['Place of birth', applicant.placeOfBirth],
    ['Citizenship', applicant.citizenship],
    ["Mother's maiden name", applicant.mothersMaidenName],
    ['Current location', applicant.currentLocation],
    [
      'Phone',
      [applicant.phoneCountryCode, applicant.phoneNumber].filter(Boolean).join(' ').trim(),
    ],
    ['Email', applicant.emailAddress],
    ['Home country address', applicant.homeCountryAddress],
    ['Postal code', applicant.postalCode],
    ['Passport', applicant.passportNumber],
    ['Passport expiry', applicant.passportExpiry],
    ['Education', applicant.education || applicant.educationalBackground],
    ['Language skills', applicant.languageSkills],
    ['Profession', applicant.profession],
    ['Shoe size', applicant.shoeSize],
    ['Clothes size', applicant.clothesSize],
    ['Authentication of Signature appointment', applicant.signatureAuthenticationAppointment],
    ['D-Visa booking appointment', applicant.dVisaBookingAppointment],
    ['Notes', applicant.notes],
  ];

  return fields.filter(([, value]) => Boolean(value));
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function getDocxImageType(mimeType) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return 'jpg';
  }

  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/gif') {
    return 'gif';
  }

  if (mimeType === 'image/bmp') {
    return 'bmp';
  }

  return null;
}

function getScaledDimensions(width, height, maxWidth = maxEmbeddedWidth) {
  const scale = maxWidth / width;
  return {
    width: maxWidth,
    height: Math.max(1, Math.round(height * scale)),
  };
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

function pageBreakParagraph() {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

function appendDefaultAvatar(children) {
  children.push(
    new Paragraph({
      children: [
        new ImageRun({
          type: 'png',
          data: getDefaultAvatarPng(),
          transformation: {
            width: 180,
            height: 180,
          },
        }),
      ],
    }),
  );
}

function appendImageParagraph(children, buffer, mimeType, transformation) {
  const imageType = getDocxImageType(mimeType);
  if (!imageType) {
    return false;
  }

  children.push(
    new Paragraph({
      children: [
        new ImageRun({
          type: imageType,
          data: buffer,
          transformation,
        }),
      ],
    }),
  );

  return true;
}

async function appendRasterImage(children, pngBuffer, sourceWidth, sourceHeight) {
  appendImageParagraph(
    children,
    pngBuffer,
    'image/png',
    getScaledDimensions(sourceWidth, sourceHeight),
  );
}

async function appendDocumentContent(children, fileBuffer, mimeType, entry) {
  const imageType = getDocxImageType(mimeType);
  if (imageType) {
    appendImageParagraph(children, fileBuffer, mimeType, {
      width: maxEmbeddedWidth,
      height: 680,
    });
    return;
  }

  if (mimeType === 'application/pdf') {
    try {
      const pages = await convertPdfToPngPages(fileBuffer);

      if (pages.length === 0) {
        children.push(paragraph('Could not render PDF pages for this document.'));
        return;
      }

      for (const [index, page] of pages.entries()) {
        if (pages.length > 1) {
          children.push(paragraph(`Page ${index + 1} of ${pages.length}`));
        }

        await appendRasterImage(children, page.pngBuffer, page.width, page.height);
      }
    } catch {
      children.push(
        paragraph(`Could not convert PDF to images: ${entry.originalName || entry.storedName}.`),
      );
    }

    return;
  }

  if (mimeType === 'image/webp') {
    try {
      const { createCanvas, loadImage } = await import('@napi-rs/canvas');
      const image = await loadImage(fileBuffer);
      const canvas = createCanvas(image.width, image.height);
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      await appendRasterImage(children, canvas.toBuffer('image/png'), image.width, image.height);
      return;
    } catch {
      children.push(
        paragraph(`Could not embed ${entry.originalName || entry.storedName}.`),
      );
    }
  }
}

async function buildApplicantWordDocument(applicant, documentStorage) {
  const children = [];
  const fullName = applicantFolderName(applicant);

  children.push(paragraph(fullName, { bold: true, heading: HeadingLevel.HEADING_1 }));
  children.push(paragraph('Profile Photo', { bold: true, heading: HeadingLevel.HEADING_2 }));

  const parsedPhoto = parseDataUrl(applicant.photo);
  if (parsedPhoto) {
    const embedded = appendImageParagraph(children, parsedPhoto.buffer, parsedPhoto.mimeType, {
      width: 180,
      height: 180,
    });
    if (!embedded) {
      appendDefaultAvatar(children);
    }
  } else {
    appendDefaultAvatar(children);
  }

  children.push(paragraph('Applicant Information', { bold: true, heading: HeadingLevel.HEADING_2 }));
  for (const [label, value] of getExportFields(applicant)) {
    children.push(labeledParagraph(label, value));
  }

  const documents = toPlainDocuments(applicant.documents);
  let hasDocumentSection = false;

  for (const type of documentTypes) {
    const entry = documents[type];
    if (!entry?.cloudPath) {
      continue;
    }

    if (!hasDocumentSection) {
      children.push(paragraph('Uploaded Documents', { bold: true, heading: HeadingLevel.HEADING_2 }));
      hasDocumentSection = true;
    }

    children.push(pageBreakParagraph());
    children.push(paragraph(documentLabels[type], { bold: true, heading: HeadingLevel.HEADING_2 }));
    children.push(paragraph(entry.originalName || entry.storedName, { italics: true }));

    try {
      const fileBuffer = await documentStorage.readFile(entry.cloudPath);
      await appendDocumentContent(children, fileBuffer, entry.mimeType, entry);
    } catch {
      children.push(paragraph('Could not load this document from storage.'));
    }
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

export async function exportApplicantToWord(applicant, documentStorage) {
  if (!documentStorage?.isConfigured) {
    throw new Error('Document storage is not configured on the server.');
  }

  const folderPath = await documentStorage.ensureApplicantFolder(applicant);
  const fullName = applicantFolderName(applicant);
  const fileName = `${fullName}.docx`;
  const relativePath = `${folderPath}/${fileName}`;
  const buffer = await buildApplicantWordDocument(applicant, documentStorage);

  await documentStorage.saveFile(relativePath, buffer);

  return {
    buffer,
    fileName,
    relativePath,
  };
}
