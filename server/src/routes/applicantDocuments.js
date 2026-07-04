import multer from 'multer';
import { exportApplicantToWord } from '../services/applicantWordExport.js';
import { documentTypes } from '../services/documentStorage.js';

const maxDocumentBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxDocumentBytes },
});

function getFileExtension(originalName, mimeType) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(originalName || '');
  if (match) {
    return `.${match[1].toLowerCase()}`;
  }

  if (mimeType === 'application/pdf') {
    return '.pdf';
  }

  if (mimeType === 'image/png') {
    return '.png';
  }

  if (mimeType === 'image/webp') {
    return '.webp';
  }

  return '.jpg';
}

function serializeDocumentEntry(entry) {
  if (!entry?.cloudPath) {
    return null;
  }

  return {
    originalName: entry.originalName || '',
    mimeType: entry.mimeType || '',
    size: entry.size || 0,
    uploadedAt: entry.uploadedAt || null,
    uploaded: true,
  };
}

export function toPlainDocuments(documents) {
  if (!documents) {
    return {};
  }

  if (typeof documents.toObject === 'function') {
    return documents.toObject();
  }

  return { ...documents };
}

export function serializeDocuments(documents = {}) {
  const plainDocuments = toPlainDocuments(documents);

  return {
    tor: serializeDocumentEntry(plainDocuments.tor),
    passport: serializeDocumentEntry(plainDocuments.passport),
    hkid: serializeDocumentEntry(plainDocuments.hkid),
  };
}

function isValidDocumentType(documentType) {
  return documentTypes.includes(documentType);
}

function storageUnavailableResponse(res) {
  return res.status(503).json({
    message: 'Document storage is not configured on the server.',
  });
}

export function registerApplicantDocumentRoutes(applicantsRouter, applicantModel, documentStorage) {
  applicantsRouter.post('/:id/export/word', async (req, res, next) => {
    try {
      if (!documentStorage?.isConfigured) {
        return storageUnavailableResponse(res);
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const { buffer, fileName, relativePath } = await exportApplicantToWord(applicant, documentStorage);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      const safeFileName = fileName.replace(/"/g, '');
      const encodedFileName = encodeURIComponent(safeFileName);
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

  applicantsRouter.post('/:id/documents/:documentType', upload.single('file'), async (req, res, next) => {
    try {
      if (!documentStorage?.isConfigured) {
        return storageUnavailableResponse(res);
      }

      if (!isValidDocumentType(req.params.documentType)) {
        return res.status(400).json({ message: 'Invalid document type' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'A document file is required' });
      }

      if (!allowedMimeTypes.has(req.file.mimetype)) {
        return res.status(400).json({ message: 'Only PDF, JPG, PNG, or WEBP files are allowed' });
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const folderPath = await documentStorage.ensureApplicantFolder(applicant);
      const extension = getFileExtension(req.file.originalname, req.file.mimetype);
      const storedName = `${req.params.documentType}${extension}`;
      const cloudPath = `${folderPath}/${storedName}`;

      await documentStorage.saveFile(cloudPath, req.file.buffer);

      const documentEntry = {
        originalName: req.file.originalname,
        storedName,
        cloudPath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
      };

      const updatedApplicant = await applicantModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            [`documents.${req.params.documentType}`]: documentEntry,
          },
        },
        { new: true },
      );

      const documents = serializeDocuments(updatedApplicant?.documents || {
        ...toPlainDocuments(applicant.documents),
        [req.params.documentType]: documentEntry,
      });

      return res.status(201).json({
        message: 'Document uploaded',
        document: serializeDocumentEntry(documentEntry),
        documents,
      });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.get('/:id/documents/:documentType', async (req, res, next) => {
    try {
      if (!documentStorage?.isConfigured) {
        return storageUnavailableResponse(res);
      }

      if (!isValidDocumentType(req.params.documentType)) {
        return res.status(400).json({ message: 'Invalid document type' });
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const documentEntry = toPlainDocuments(applicant.documents)[req.params.documentType];
      if (!documentEntry?.cloudPath) {
        return res.status(404).json({ message: 'Document not uploaded yet' });
      }

      const fileBuffer = await documentStorage.readFile(documentEntry.cloudPath);
      res.setHeader('Content-Type', documentEntry.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${documentEntry.originalName || documentEntry.storedName}"`);
      return res.send(fileBuffer);
    } catch (error) {
      if (error.code === 'ENOENT' || String(error.message).includes('not found')) {
        return res.status(404).json({ message: 'Document file not found' });
      }

      return next(error);
    }
  });

  applicantsRouter.delete('/:id/documents/:documentType', async (req, res, next) => {
    try {
      if (!documentStorage?.isConfigured) {
        return storageUnavailableResponse(res);
      }

      if (!isValidDocumentType(req.params.documentType)) {
        return res.status(400).json({ message: 'Invalid document type' });
      }

      const applicant = await applicantModel.findOne({ _id: req.params.id });
      if (!applicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const documentEntry = toPlainDocuments(applicant.documents)[req.params.documentType];
      if (!documentEntry?.cloudPath) {
        return res.status(404).json({ message: 'Document not uploaded yet' });
      }

      await documentStorage.deleteFile(documentEntry.cloudPath);

      const updatedApplicant = await applicantModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          $unset: {
            [`documents.${req.params.documentType}`]: '',
          },
        },
        { new: true },
      );

      return res.json({
        message: 'Document deleted',
        documents: serializeDocuments(updatedApplicant?.documents),
      });
    } catch (error) {
      return next(error);
    }
  });
}
