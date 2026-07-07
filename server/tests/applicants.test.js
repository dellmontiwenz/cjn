import request from 'supertest';
import { createApp } from '../src/app.js';
import { formatRegisteredApplicantName } from '../src/routes/applicants.js';

let User;
let Applicant;
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
    async findOneAndUpdate({ _id }, data, options = {}) {
      const index = applicants.findIndex((applicant) => applicant._id.toString() === _id);

      if (index === -1) {
        return null;
      }

      const previousApplicant = { ...applicants[index] };
      applicants[index] = {
        ...applicants[index],
        ...data,
      };

      return options.returnDocument === 'after' || options.new === true
        ? applicants[index]
        : previousApplicant;
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

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_REGISTRATION_PASSWORD = 'admin-secret-123';
  User = createMemoryUserModel();
  Applicant = createMemoryApplicantModel();
  app = createApp({ userModel: User, applicantModel: Applicant });
});

test('requires a token to create an applicant', async () => {
  const response = await request(app)
    .post('/api/applicants')
    .send({ firstName: 'Maria' });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe('Missing authorization token');
});

test('creates an applicant for the logged-in user', async () => {
  const token = await registerAndLogin();

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
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      passportExpiry: '2030-12-31',
      education: 'Bachelor of Science in Nursing',
      maidenName: 'Garcia',
      placeOfBirth: 'Manila, Philippines',
      citizenship: 'Filipino',
      mothersMaidenName: 'Lopez',
      currentLocation: 'Dubai, UAE',
      homeCountryAddress: '123 Rizal Street, Quezon City',
      postalCode: '1100',
      languageSkills: 'English, Tagalog',
      profession: 'Registered Nurse',
      shoeSize: '7',
      clothesSize: 'M',
    });

  expect(response.status).toBe(201);
  expect(response.body.applicant).toMatchObject({
    firstName: 'Maria',
    middleName: 'Santos',
    lastName: 'Reyes',
    maidenName: 'Garcia',
    dateOfBirth: '1997-05-20',
    sex: 'Female',
    placeOfBirth: 'Manila, Philippines',
    citizenship: 'Filipino',
    mothersMaidenName: 'Lopez',
    currentLocation: 'Dubai, UAE',
    phoneCountryCode: '+63',
    phoneNumber: '9171234567',
    emailAddress: 'maria@example.com',
    homeCountryAddress: '123 Rizal Street, Quezon City',
    postalCode: '1100',
    passportNumber: 'P1234567',
    passportExpiry: '2030-12-31',
    education: 'Bachelor of Science in Nursing',
    languageSkills: 'English, Tagalog',
    profession: 'Registered Nurse',
    shoeSize: '7',
    clothesSize: 'M',
  });
  expect(response.body.applicant.createdBy).toBe('1');
});

test('lists applicants saved by the logged-in user', async () => {
  const token = await registerAndLogin();

  await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '+639171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
    });

  const response = await request(app)
    .get('/api/applicants')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.applicants).toHaveLength(1);
  expect(response.body.applicants[0].firstName).toBe('Maria');
  expect(response.body.applicants[0].passportNumber).toBe('P1234567');
});

test('lets any logged-in user access applicants saved by another user', async () => {
  const adminToken = await registerAndLogin('dellmonti1106');

  await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '9171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
    });

  const staffToken = await registerAndLogin('staffuser');

  const response = await request(app)
    .get('/api/applicants')
    .set('Authorization', `Bearer ${staffToken}`);

  expect(response.status).toBe(200);
  expect(response.body.applicants).toHaveLength(1);
  expect(response.body.applicants[0].firstName).toBe('Maria');
});

test('rejects an applicant with an invalid email address', async () => {
  const token = await registerAndLogin();

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '9171234567',
      emailAddress: 'maria(at)example',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Please enter a valid email address');
});

test('rejects an applicant with an invalid phone number', async () => {
  const token = await registerAndLogin();

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '12ab',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Please enter a valid phone number (6 to 15 digits)');
});

test('stores a phone country code alongside the phone number', async () => {
  const token = await registerAndLogin();

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Anna',
      lastName: 'Wong',
      dateOfBirth: '1995-03-10',
      sex: 'Female',
      phoneCountryCode: '+852',
      phoneNumber: '98765432',
      emailAddress: 'anna@example.com',
      passportNumber: 'HK998877',
      education: 'Bachelor of Arts',
    });

  expect(response.status).toBe(201);
  expect(response.body.applicant.phoneCountryCode).toBe('+852');
  expect(response.body.applicant.phoneNumber).toBe('98765432');
});

test('stores Hungary appointment answers for an applicant', async () => {
  const token = await registerAndLogin();

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '9171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
      signatureAuthenticationAppointment: 'Yes',
      dVisaBookingAppointment: 'No',
    });

  expect(response.status).toBe(201);
  expect(response.body.applicant.signatureAuthenticationAppointment).toBe('Yes');
  expect(response.body.applicant.dVisaBookingAppointment).toBe('No');
});

test('stores notes for an applicant', async () => {
  const token = await registerAndLogin();

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '9171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
      notes: 'Passport scan pending. Birth certificate spells surname as "Reyez".',
    });

  expect(response.status).toBe(201);
  expect(response.body.applicant.notes).toBe(
    'Passport scan pending. Birth certificate spells surname as "Reyez".',
  );
});

test('stores an uploaded photo for an applicant', async () => {
  const token = await registerAndLogin();

  const photoDataUrl = 'data:image/png;base64,aGVsbG8=';

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '9171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
      photo: photoDataUrl,
    });

  expect(response.status).toBe(201);
  expect(response.body.applicant.photo).toBe(photoDataUrl);
});

test('returns an empty photo when none is uploaded', async () => {
  const token = await registerAndLogin();

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Anna',
      lastName: 'Wong',
      dateOfBirth: '1995-03-10',
      sex: 'Female',
      phoneNumber: '98765432',
      emailAddress: 'anna@example.com',
      passportNumber: 'HK998877',
      education: 'Bachelor of Arts',
    });

  expect(response.status).toBe(201);
  expect(response.body.applicant.photo).toBe('');
});

test('rejects a duplicate applicant with the same full name and email', async () => {
  const token = await registerAndLogin();

  const applicantPayload = {
    firstName: 'Maria',
    middleName: 'Santos',
    lastName: 'Reyes',
    dateOfBirth: '1997-05-20',
    sex: 'Female',
    phoneNumber: '9171234567',
    emailAddress: 'maria@example.com',
    passportNumber: 'P1234567',
    education: 'Bachelor of Science in Nursing',
  };

  const firstResponse = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send(applicantPayload);

  expect(firstResponse.status).toBe(201);

  const duplicateResponse = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...applicantPayload, passportNumber: 'P9999999' });

  expect(duplicateResponse.status).toBe(409);
  expect(duplicateResponse.body.message).toBe('An applicant with the same full name and email already exists');

  const listResponse = await request(app)
    .get('/api/applicants')
    .set('Authorization', `Bearer ${token}`);

  expect(listResponse.body.applicants).toHaveLength(1);
});

test('allows a new applicant when the email differs from an existing full name', async () => {
  const token = await registerAndLogin();

  const applicantPayload = {
    firstName: 'Maria',
    middleName: 'Santos',
    lastName: 'Reyes',
    dateOfBirth: '1997-05-20',
    sex: 'Female',
    phoneNumber: '9171234567',
    emailAddress: 'maria@example.com',
    passportNumber: 'P1234567',
    education: 'Bachelor of Science in Nursing',
  };

  await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send(applicantPayload);

  const response = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...applicantPayload, emailAddress: 'maria.reyes@example.com' });

  expect(response.status).toBe(201);
});

test('deletes an applicant saved by the logged-in user', async () => {
  const token = await registerAndLogin();

  const createResponse = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '+639171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
    });

  const deleteResponse = await request(app)
    .delete(`/api/applicants/${createResponse.body.applicant.id}`)
    .set('Authorization', `Bearer ${token}`);

  expect(deleteResponse.status).toBe(200);
  expect(deleteResponse.body.message).toBe('Applicant deleted successfully');

  const listResponse = await request(app)
    .get('/api/applicants')
    .set('Authorization', `Bearer ${token}`);

  expect(listResponse.body.applicants).toHaveLength(0);
});

test('updates an applicant saved by the logged-in user', async () => {
  const token = await registerAndLogin();

  const createResponse = await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '+639171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
    });

  const updateResponse = await request(app)
    .put(`/api/applicants/${createResponse.body.applicant.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Reyes',
      dateOfBirth: '1996-05-20',
      sex: 'Female',
      phoneNumber: '+639171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
      currentLocation: 'Singapore',
      profession: 'ICU Nurse',
    });

  expect(updateResponse.status).toBe(200);
  expect(updateResponse.body.applicant).toMatchObject({
    firstName: 'Maria',
    dateOfBirth: '1996-05-20',
    currentLocation: 'Singapore',
    profession: 'ICU Nurse',
  });

  const listResponse = await request(app)
    .get('/api/applicants')
    .set('Authorization', `Bearer ${token}`);

  expect(listResponse.body.applicants[0].currentLocation).toBe('Singapore');
  expect(listResponse.body.applicants[0].profession).toBe('ICU Nurse');
});

test('formats registered applicant names as surname, first name, and middle name', () => {
  expect(
    formatRegisteredApplicantName({
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Reyes',
    }),
  ).toBe('Reyes, Maria Santos');

  expect(
    formatRegisteredApplicantName({
      firstName: 'Anna',
      middleName: '',
      lastName: 'Wong',
    }),
  ).toBe('Wong, Anna');
});

test('returns registered applicant names for admins only', async () => {
  const adminToken = await registerAndLogin('dellmonti1106');
  const staffToken = await registerAndLogin('staffuser');

  await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Reyes',
      dateOfBirth: '1997-05-20',
      sex: 'Female',
      phoneNumber: '9171234567',
      emailAddress: 'maria@example.com',
      passportNumber: 'P1234567',
      education: 'Bachelor of Science in Nursing',
    });

  await request(app)
    .post('/api/applicants')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'Anna',
      lastName: 'Wong',
      dateOfBirth: '1995-03-10',
      sex: 'Female',
      phoneNumber: '98765432',
      emailAddress: 'anna@example.com',
      passportNumber: 'HK998877',
      education: 'Bachelor of Arts',
    });

  const forbiddenResponse = await request(app)
    .get('/api/applicants/names')
    .set('Authorization', `Bearer ${staffToken}`);

  expect(forbiddenResponse.status).toBe(403);
  expect(forbiddenResponse.body.message).toBe('Admin access required');

  const response = await request(app)
    .get('/api/applicants/names')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(response.status).toBe(200);
  expect(response.body.applicants).toEqual([
    {
      id: '1',
      lastName: 'Reyes',
      firstName: 'Maria',
      middleName: 'Santos',
      registeredName: 'Reyes, Maria Santos',
    },
    {
      id: '2',
      lastName: 'Wong',
      firstName: 'Anna',
      middleName: '',
      registeredName: 'Wong, Anna',
    },
  ]);
});
