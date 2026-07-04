import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const documentTypes = ['tor', 'passport', 'hkid'];

const serverServicesDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverServicesDir, '../../..');
const defaultStorageRoot = path.join(projectRoot, 'cjn');

export function applicantFolderName(applicant) {
  return [applicant.firstName, applicant.middleName, applicant.lastName]
    .filter(Boolean)
    .join(' ')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createFilesystemStorage(storageRoot) {
  return {
    isConfigured: true,
    storageRoot,
    async ensureApplicantFolder(applicant) {
      const folderPath = applicantFolderName(applicant);
      await fs.mkdir(path.join(storageRoot, folderPath), { recursive: true });
      return folderPath;
    },
    async saveFile(relativePath, buffer) {
      const fullPath = path.join(storageRoot, relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, buffer);
    },
    async readFile(relativePath) {
      return fs.readFile(path.join(storageRoot, relativePath));
    },
    async deleteFile(relativePath) {
      try {
        await fs.unlink(path.join(storageRoot, relativePath));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}

export function createMemoryDocumentStorage() {
  const files = new Map();

  return {
    isConfigured: true,
    storageRoot: '/memory/cjn',
    async ensureApplicantFolder(applicant) {
      const folderPath = applicantFolderName(applicant);
      files.set(`__dir__:${folderPath}`, true);
      return folderPath;
    },
    async saveFile(relativePath, buffer) {
      files.set(relativePath, Buffer.from(buffer));
    },
    async readFile(relativePath) {
      if (!files.has(relativePath)) {
        const error = new Error('File not found');
        error.code = 'ENOENT';
        throw error;
      }

      return files.get(relativePath);
    },
    async deleteFile(relativePath) {
      files.delete(relativePath);
    },
  };
}

export function createDocumentStorageFromEnv() {
  const storageRoot = process.env.CJN_DOCUMENTS_ROOT
    ? path.resolve(process.env.CJN_DOCUMENTS_ROOT)
    : defaultStorageRoot;

  return createFilesystemStorage(storageRoot);
}
