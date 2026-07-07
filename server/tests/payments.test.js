import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMemoryDocumentStorage } from '../src/services/documentStorage.js';

let User;
let Applicant;
let documentStorage;
let app;
let paymentEntryCounter = 0;

function createMemoryUserModel() {
  const users = [];

  return {
    async findOne(query) {
      if (query.username) {
        return users.find((user) => user.username === query.username) || null;
      }

      if (query._id) {
        const targetId = typeof query._id === 'string' ? query._id : query._id.toString();
        return users.find((user) => user._id.toString() === targetId) || null;
      }

      return null;
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
        payment: { totalFees: 0, entries: [] },
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
    async findOneAndUpdate({ _id }, update, options = {}) {
      const index = applicants.findIndex((applicant) => applicant._id.toString() === _id);

      if (index === -1) {
        return null;
      }

      const previousApplicant = { ...applicants[index] };
      let nextApplicant = { ...applicants[index] };

      if (update.$set?.payment) {
        const payment = update.$set.payment;
        nextApplicant.payment = {
          totalFees: payment.totalFees ?? nextApplicant.payment?.totalFees ?? 0,
          entries: (payment.entries || []).map((entry) => ({
            ...entry,
            _id: entry._id || String(++paymentEntryCounter),
          })),
        };
      } else if (!update.$set && !update.$unset) {
        nextApplicant = {
          ...nextApplicant,
          ...update,
        };
      }

      applicants[index] = nextApplicant;
      return options.returnDocument === 'after' || options.new === true
        ? nextApplicant
        : previousApplicant;
    },
  };
}

async function registerAndLogin() {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'wendell',
      password: 'password123',
      adminPassword: process.env.ADMIN_REGISTRATION_PASSWORD || 'admin-secret-123',
    });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'wendell', password: 'password123' });

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
      phoneNumber: '9171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science',
    });

  return response.body.applicant;
}

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_REGISTRATION_PASSWORD = 'admin-secret-123';
  paymentEntryCounter = 0;
  User = createMemoryUserModel();
  Applicant = createMemoryApplicantModel();
  documentStorage = createMemoryDocumentStorage();
  app = createApp({ userModel: User, applicantModel: Applicant, documentStorage });
});

test('returns empty payment details for a new applicant', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  const response = await request(app)
    .get(`/api/applicants/${applicant.id}/payments`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.payment).toEqual({
    totalFees: 0,
    entries: [],
    totalPaid: 0,
    balance: 0,
  });
});

test('saves total fees for an applicant', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  const response = await request(app)
    .put(`/api/applicants/${applicant.id}/payments/total-fees`)
    .set('Authorization', `Bearer ${token}`)
    .send({ totalFees: 50000 });

  expect(response.status).toBe(200);
  expect(response.body.payment.totalFees).toBe(50000);
  expect(response.body.payment.balance).toBe(50000);
});

test('records payment entries and deducts them from the balance', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  await request(app)
    .put(`/api/applicants/${applicant.id}/payments/total-fees`)
    .set('Authorization', `Bearer ${token}`)
    .send({ totalFees: 50000 });

  const firstPayment = await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-01', amount: 15000 });

  expect(firstPayment.status).toBe(201);
  expect(firstPayment.body.payment.totalPaid).toBe(15000);
  expect(firstPayment.body.payment.balance).toBe(35000);

  const secondPayment = await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-07', amount: 10000 });

  expect(secondPayment.status).toBe(201);
  expect(secondPayment.body.payment.totalPaid).toBe(25000);
  expect(secondPayment.body.payment.balance).toBe(25000);
  expect(secondPayment.body.payment.entries).toHaveLength(2);
});

test('rejects invalid payment entries', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  const response = await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-07', amount: 0 });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Payment amount must be greater than 0');
});

test('includes payment summary when listing applicants', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  await request(app)
    .put(`/api/applicants/${applicant.id}/payments/total-fees`)
    .set('Authorization', `Bearer ${token}`)
    .send({ totalFees: 30000 });

  await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-07', amount: 12000 });

  const response = await request(app)
    .get('/api/applicants')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.applicants[0].payment).toEqual({
    totalFees: 30000,
    totalPaid: 12000,
    balance: 18000,
    entries: expect.arrayContaining([
      expect.objectContaining({
        paidAt: '2026-07-07',
        amount: 12000,
      }),
    ]),
  });
});

test('clears payment history while keeping total fees', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  await request(app)
    .put(`/api/applicants/${applicant.id}/payments/total-fees`)
    .set('Authorization', `Bearer ${token}`)
    .send({ totalFees: 40000 });

  await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-07', amount: 10000 });

  const response = await request(app)
    .delete(`/api/applicants/${applicant.id}/payments/history`)
    .set('Authorization', `Bearer ${token}`)
    .send({ adminPassword: 'admin-secret-123' });

  expect(response.status).toBe(200);
  expect(response.body.payment).toEqual({
    totalFees: 0,
    entries: [],
    totalPaid: 0,
    balance: 0,
  });
});

test('requires administration password to clear payment history', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-07', amount: 10000 });

  const forbiddenResponse = await request(app)
    .delete(`/api/applicants/${applicant.id}/payments/history`)
    .set('Authorization', `Bearer ${token}`)
    .send({ adminPassword: 'wrong-password' });

  expect(forbiddenResponse.status).toBe(403);
  expect(forbiddenResponse.body.message).toBe('Invalid administration password');

  const missingPasswordResponse = await request(app)
    .delete(`/api/applicants/${applicant.id}/payments/history`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  expect(missingPasswordResponse.status).toBe(400);
  expect(missingPasswordResponse.body.message).toBe('Administration password is required');
});

test('requires administration password to delete a payment entry', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  const createResponse = await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-07', amount: 10000 });

  const entryId = createResponse.body.payment.entries[0].id;

  const response = await request(app)
    .delete(`/api/applicants/${applicant.id}/payments/entries/${entryId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ adminPassword: 'admin-secret-123' });

  expect(response.status).toBe(200);
  expect(response.body.payment.entries).toHaveLength(0);
});

test('exports payment details to Word', async () => {
  const token = await registerAndLogin();
  const applicant = await createSampleApplicant(token);

  await request(app)
    .put(`/api/applicants/${applicant.id}/payments/total-fees`)
    .set('Authorization', `Bearer ${token}`)
    .send({ totalFees: 25000 });

  await request(app)
    .post(`/api/applicants/${applicant.id}/payments/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAt: '2026-07-07', amount: 5000 });

  const exportResponse = await request(app)
    .post(`/api/applicants/${applicant.id}/payments/export/word`)
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
  expect(exportResponse.headers['x-cjn-filename']).toBe('Maria Santos Reyes - Payments.docx');
  expect(exportResponse.headers['x-cjn-saved-path']).toBe('Maria Santos Reyes/Maria Santos Reyes - Payments.docx');
});
