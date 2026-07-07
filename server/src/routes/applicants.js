import express from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { Applicant } from '../models/Applicant.js';
import { registerApplicantDocumentRoutes, serializeDocuments } from './applicantDocuments.js';

const requiredFields = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'sex',
  'phoneNumber',
  'emailAddress',
  'passportNumber',
  'education',
];

const duplicateMessage = 'An applicant with the same full name and email already exists';

function applicantFullName(applicant) {
  return [applicant.firstName, applicant.middleName, applicant.lastName]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function formatRegisteredApplicantName(applicant) {
  const lastName = String(applicant.lastName || '').trim();
  const firstName = String(applicant.firstName || '').trim();
  const middleName = String(applicant.middleName || '').trim();
  const givenNames = [firstName, middleName].filter(Boolean).join(' ');

  if (!lastName) {
    return givenNames;
  }

  return givenNames ? `${lastName}, ${givenNames}` : lastName;
}

function compareRegisteredNames(left, right) {
  const lastNameCompare = left.lastName.localeCompare(right.lastName, undefined, { sensitivity: 'base' });
  if (lastNameCompare !== 0) {
    return lastNameCompare;
  }

  const firstNameCompare = left.firstName.localeCompare(right.firstName, undefined, { sensitivity: 'base' });
  if (firstNameCompare !== 0) {
    return firstNameCompare;
  }

  return left.middleName.localeCompare(right.middleName, undefined, { sensitivity: 'base' });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isDuplicateApplicant(existingApplicants, applicantData, excludeId) {
  const targetName = applicantFullName(applicantData);
  const targetEmail = normalizeEmail(applicantData.emailAddress);

  return existingApplicants.some((applicant) => {
    if (excludeId && applicant._id.toString() === excludeId) {
      return false;
    }

    return applicantFullName(applicant) === targetName && normalizeEmail(applicant.emailAddress) === targetEmail;
  });
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return emailPattern.test(email);
}

function isValidPhoneNumber(phoneNumber) {
  const digitsOnly = phoneNumber.replace(/[\s()-]/g, '').replace(/^\+/, '');
  return /^\d{6,15}$/.test(digitsOnly);
}

function getValidationError(applicantData) {
  const missingField = requiredFields.find((field) => !applicantData[field]);
  if (missingField) {
    return 'All required applicant fields must be completed';
  }

  if (!isValidEmail(applicantData.emailAddress)) {
    return 'Please enter a valid email address';
  }

  if (!isValidPhoneNumber(applicantData.phoneNumber)) {
    return 'Please enter a valid phone number (6 to 15 digits)';
  }

  return null;
}

function cleanApplicant(body, userId) {
  return {
    firstName: String(body.firstName || '').trim(),
    middleName: String(body.middleName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    maidenName: String(body.maidenName || '').trim(),
    dateOfBirth: String(body.dateOfBirth || '').trim(),
    sex: String(body.sex || '').trim(),
    placeOfBirth: String(body.placeOfBirth || '').trim(),
    citizenship: String(body.citizenship || '').trim(),
    mothersMaidenName: String(body.mothersMaidenName || '').trim(),
    currentLocation: String(body.currentLocation || '').trim(),
    phoneCountryCode: String(body.phoneCountryCode || '').trim(),
    phoneNumber: String(body.phoneNumber || '').trim(),
    emailAddress: String(body.emailAddress || '').trim().toLowerCase(),
    homeCountryAddress: String(body.homeCountryAddress || '').trim(),
    postalCode: String(body.postalCode || '').trim(),
    passportNumber: String(body.passportNumber || '').trim(),
    passportExpiry: String(body.passportExpiry || '').trim(),
    education: String(body.education || body.educationalBackground || '').trim(),
    languageSkills: String(body.languageSkills || '').trim(),
    profession: String(body.profession || '').trim(),
    shoeSize: String(body.shoeSize || '').trim(),
    clothesSize: String(body.clothesSize || '').trim(),
    signatureAuthenticationAppointment: String(body.signatureAuthenticationAppointment || '').trim(),
    dVisaBookingAppointment: String(body.dVisaBookingAppointment || '').trim(),
    notes: String(body.notes || '').trim(),
    photo: String(body.photo || '').trim(),
    createdBy: userId,
  };
}

function serializeApplicant(applicant) {
  return {
    id: applicant._id.toString(),
    firstName: applicant.firstName,
    middleName: applicant.middleName || '',
    lastName: applicant.lastName,
    maidenName: applicant.maidenName || '',
    dateOfBirth: applicant.dateOfBirth || '',
    sex: applicant.sex,
    placeOfBirth: applicant.placeOfBirth || '',
    citizenship: applicant.citizenship || '',
    mothersMaidenName: applicant.mothersMaidenName || '',
    currentLocation: applicant.currentLocation || '',
    phoneCountryCode: applicant.phoneCountryCode || '',
    phoneNumber: applicant.phoneNumber,
    emailAddress: applicant.emailAddress,
    homeCountryAddress: applicant.homeCountryAddress || '',
    postalCode: applicant.postalCode || '',
    passportNumber: applicant.passportNumber,
    passportExpiry: applicant.passportExpiry || '',
    education: applicant.education || applicant.educationalBackground || '',
    languageSkills: applicant.languageSkills || '',
    profession: applicant.profession || '',
    shoeSize: applicant.shoeSize || '',
    clothesSize: applicant.clothesSize || '',
    signatureAuthenticationAppointment: applicant.signatureAuthenticationAppointment || '',
    dVisaBookingAppointment: applicant.dVisaBookingAppointment || '',
    notes: applicant.notes || '',
    photo: applicant.photo || '',
    documents: serializeDocuments(applicant.documents),
    createdBy: applicant.createdBy,
  };
}

export function createApplicantsRouter(applicantModel = Applicant, documentStorage = null) {
  const applicantsRouter = express.Router();

  applicantsRouter.use(requireAuth);

  applicantsRouter.post('/', async (req, res, next) => {
    try {
      const applicantData = cleanApplicant(req.body, req.user.id);
      const validationError = getValidationError(applicantData);

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const existingApplicants = await applicantModel.find({}).sort({ createdAt: -1 });
      if (isDuplicateApplicant(existingApplicants, applicantData)) {
        return res.status(409).json({ message: duplicateMessage });
      }

      const applicant = await applicantModel.create(applicantData);

      return res.status(201).json({ applicant: serializeApplicant(applicant) });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.get('/', async (req, res, next) => {
    try {
      const applicants = await applicantModel.find({}).sort({ createdAt: -1 });

      return res.json({ applicants: applicants.map(serializeApplicant) });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.get('/names', requireAdmin, async (req, res, next) => {
    try {
      const applicants = await applicantModel.find({}).sort({ createdAt: -1 });
      const names = applicants
        .map((applicant) => ({
          id: applicant._id.toString(),
          lastName: applicant.lastName || '',
          firstName: applicant.firstName || '',
          middleName: applicant.middleName || '',
          registeredName: formatRegisteredApplicantName(applicant),
        }))
        .sort(compareRegisteredNames);

      return res.json({ applicants: names });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.put('/:id', async (req, res, next) => {
    try {
      const applicantData = cleanApplicant(req.body, req.user.id);
      const validationError = getValidationError(applicantData);

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const existingApplicants = await applicantModel.find({}).sort({ createdAt: -1 });
      if (isDuplicateApplicant(existingApplicants, applicantData, req.params.id)) {
        return res.status(409).json({ message: duplicateMessage });
      }

      const currentApplicant = await applicantModel.findOne({ _id: req.params.id });
      if (!currentApplicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      const updatedApplicant = await applicantModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          ...applicantData,
          createdBy: currentApplicant.createdBy,
        },
        { new: true },
      );

      if (!updatedApplicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      return res.json({ applicant: serializeApplicant(updatedApplicant) });
    } catch (error) {
      return next(error);
    }
  });

  applicantsRouter.delete('/:id', async (req, res, next) => {
    try {
      const deletedApplicant = await applicantModel.findOneAndDelete({
        _id: req.params.id,
      });

      if (!deletedApplicant) {
        return res.status(404).json({ message: 'Applicant not found' });
      }

      return res.json({ message: 'Applicant deleted successfully' });
    } catch (error) {
      return next(error);
    }
  });

  registerApplicantDocumentRoutes(applicantsRouter, applicantModel, documentStorage);

  return applicantsRouter;
}
