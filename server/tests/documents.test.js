import request from 'supertest';
import JSZip from 'jszip';
import { createApp } from '../src/app.js';
import { createMemoryDocumentStorage } from '../src/services/documentStorage.js';

const samplePdfBuffer = Buffer.from(
  '%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length 44 >>stream\nBT /F1 24 Tf 20 100 Td (Hi) Tj ET\nendstream\nendobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000274 00000 n \n0000000373 00000 n \ntrailer<< /Size 6 /Root 1 0 R >>\nstartxref\n445\n%%EOF',
);

let User;
let Applicant;
let documentStorage;
let app;

function createMemoryUserModel() {
  const users = [];

  return {
    async findOne({ username }) {
      return users.find((user) => user.username === username) || null;
    },
    async create(data) {
      const id = String(users.length + 1);
      const user = {
        _id: { toString: () => id },
        ...data,
      };
      users.push(user);
      return user;
    },
  };
}

function createMemoryApplicantModel() {
  const applicants = [];

  return {
    async create(data) {
      const id = String(applicants.length + 1);
      const applicant = {
        _id: { toString: () => id },
        documents: {},
        ...data,
      };
      applicants.push(applicant);
      return applicant;
    },
    find() {
      return {
        sort: async () => applicants,
      };
    },
    async findOne({ _id }) {
      return applicants.find((applicant) => applicant._id.toString() === _id) || null;
    },
    async findOneAndDelete({ _id }) {
      const index = applicants.findIndex((applicant) => applicant._id.toString() === _id);

      if (index === -1) {
        return null;
      }

      const [deletedApplicant] = applicants.splice(index, 1);
      return deletedApplicant;
    },
    async findOneAndUpdate({ _id }, update, options = {}) {
      const index = applicants.findIndex((applicant) => applicant._id.toString() === _id);

      if (index === -1) {
        return null;
      }

      const currentApplicant = applicants[index];
      let nextApplicant = { ...currentApplicant };

      if (update.$set) {
        for (const [key, value] of Object.entries(update.$set)) {
          if (key.startsWith('documents.')) {
            const documentType = key.slice('documents.'.length);
            nextApplicant.documents = {
              ...(nextApplicant.documents || {}),
              [documentType]: value,
            };
          } else {
            nextApplicant[key] = value;
          }
        }
      }

      if (update.$unset) {
        for (const key of Object.keys(update.$unset)) {
          if (key.startsWith('documents.')) {
            const documentType = key.slice('documents.'.length);
            nextApplicant.documents = { ...(nextApplicant.documents || {}) };
            delete nextApplicant.documents[documentType];
          } else {
            delete nextApplicant[key];
          }
        }
      }

      if (!update.$set && !update.$unset) {
        nextApplicant = {
          ...currentApplicant,
          ...update,
        };
      }

      applicants[index] = nextApplicant;
      return options.returnDocument === 'after' || options.new === true
        ? nextApplicant
        : currentApplicant;
    },
  };
}

async function registerAndLogin(username = 'wendell') {
  await request(app)
    .post('/api/auth/register')
    .send({
      username,
      password: 'password123',
      adminPassword: process.env.ADMIN_REGISTRATION_PASSWORD || 'admin-secret-123',
    });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'password123' });

  return response.body.token;
}

async function createSampleApplicant(token) {
  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneCountryCode: '+63',
      phoneNumber: '9171234567',
      emailAddress: 'maria.reyes@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science',
    });

  return response.body.applicant;
}

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_REGISTRATION_PASSWORD = 'admin-secret-123';
  User = createMemoryUserModel();
  Applicant = createMemoryApplicantModel();
  documentStorage = createMemoryDocumentStorage();
  app = createApp({ userModel: User, applicantModel: Applicant, documentStorage });
});

test('requires a token to upload a document', async () => {
  const response = await request(app)
    .post('/api/applicants/1/documents/tor')
    .attach('file', Buffer.from('%PDF-1.4'), { filename: 'tor.pdf', contentType: 'application/pdf' });

  expect(response.status).toBe(401);
});

test('uploads, views, and deletes a TOR document', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);
  const pdfBuffer = Buffer.from('%PDF-1.4 test document');

  const uploadResponse = await request(app)
    .post(`/api/applicants/${applicant.id}/documents/tor`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', pdfBuffer, { filename: 'tor.pdf', contentType: 'application/pdf' });

  expect(uploadResponse.status).toBe(201);
  expect(uploadResponse.body.document.uploaded).toBe(true);
  expect(uploadResponse.body.documents.tor.originalName).toBe('tor.pdf');

  const listResponse = await request(app)
    .get('/api/applicants')
    .set('Authorization', `Bearer ${token}`);

  expect(listResponse.body.applicants[0].documents.tor.uploaded).toBe(true);

  const viewResponse = await request(app)
    .get(`/api/applicants/${applicant.id}/documents/tor`)
    .set('Authorization', `Bearer ${token}`);

  expect(viewResponse.status).toBe(200);
  expect(viewResponse.headers['content-type']).toContain('application/pdf');
  expect(viewResponse.body.toString()).toBe(pdfBuffer.toString());

  const deleteResponse = await request(app)
    .delete(`/api/applicants/${applicant.id}/documents/tor`)
    .set('Authorization', `Bearer ${token}`);

  expect(deleteResponse.status).toBe(200);
  expect(deleteResponse.body.documents.tor).toBeNull();

  const missingResponse = await request(app)
    .get(`/api/applicants/${applicant.id}/documents/tor`)
    .set('Authorization', `Bearer ${token}`);

  expect(missingResponse.status).toBe(404);
});

test('rejects invalid document types', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  const response = await request(app)
    .post(`/api/applicants/${applicant.id}/documents/visa`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from('%PDF-1.4'), { filename: 'visa.pdf', contentType: 'application/pdf' });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Invalid document type');
});

test('returns 503 when cloud storage is not configured', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);
  const appWithoutStorage = createApp({ userModel: User, applicantModel: Applicant, documentStorage: null });

  const response = await request(appWithoutStorage)
    .post(`/api/applicants/${applicant.id}/documents/passport`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from('%PDF-1.4'), { filename: 'passport.pdf', contentType: 'application/pdf' });

  expect(response.status).toBe(503);
});

test('exports applicant profile to Word and saves it in the applicant folder', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  const exportWithoutPhotoResponse = await request(app)
    .post(`/api/applicants/${applicant.id}/export/word`)
    .set('Authorization', `Bearer ${token}`);

  expect(exportWithoutPhotoResponse.status).toBe(200);
  expect(Number(exportWithoutPhotoResponse.headers['content-length'])).toBeGreaterThan(100);

  const photoDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  await request(app)
    .put(`/api/applicants/${applicant.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneCountryCode: '+63',
      phoneNumber: '9171234567',
      emailAddress: 'maria.reyes@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science',
      photo: photoDataUrl,
    });

  await request(app)
    .post(`/api/applicants/${applicant.id}/documents/tor`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', samplePdfBuffer, { filename: 'tor.pdf', contentType: 'application/pdf' });

  const exportResponse = await request(app)
    .post(`/api/applicants/${applicant.id}/export/word`)
    .set('Authorization', `Bearer ${token}`)
    .buffer()
    .parse((response, callback) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

  expect(exportResponse.status).toBe(200);
  expect(exportResponse.headers['content-type']).toContain('wordprocessingml');
  expect(Number(exportResponse.headers['content-length'])).toBeGreaterThan(100);
  expect(exportResponse.headers['x-cjn-saved-path']).toBe('Maria Santos Reyes/Maria Santos Reyes.docx');
  expect(exportResponse.headers['x-cjn-filename']).toBe('Maria Santos Reyes.docx');

  const zip = await JSZip.loadAsync(exportResponse.body);
  const documentXml = await zip.file('word/document.xml').async('string');
  expect(documentXml).not.toMatch(/<\/w:p><w:r>/);
  expect(documentXml).toMatch(/<w:p><w:r><w:br w:type="page"\/><\/w:r><\/w:p>/);
});
