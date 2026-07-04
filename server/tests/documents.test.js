import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMemoryDocumentStorage } from '../src/services/documentStorage.js';

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
      return options.new === false ? currentApplicant : nextApplicant;
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
