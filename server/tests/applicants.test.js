import request from 'supertest';
import { createApp } from '../src/app.js';

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
    async findOneAndDelete({ _id, createdBy }) {
      const index = applicants.findIndex((applicant) => applicant._id.toString() === _id && applicant.createdBy === createdBy);

      if (index === -1) {
        return null;
      }

      const [deletedApplicant] = applicants.splice(index, 1);
      return deletedApplicant;
    },
    async findOneAndUpdate({ _id, createdBy }, data) {
      const index = applicants.findIndex((applicant) => applicant._id.toString() === _id && applicant.createdBy === createdBy);

      if (index === -1) {
        return null;
      }

      applicants[index] = {
        ...applicants[index],
        ...data,
      };

      return applicants[index];
    },
  };
}

async function registerAndLogin(username = 'wendell') {
  await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'password123' });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'password123' });

  return response.body.token;
}

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
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
