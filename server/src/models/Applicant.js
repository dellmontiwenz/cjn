import mongoose from 'mongoose';

const uploadedDocumentSchema = new mongoose.Schema(
  {
    originalName: { type: String, default: '' },
    storedName: { type: String, default: '' },
    cloudPath: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: String, default: '' },
  },
  { _id: false },
);

const applicantSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    middleName: {
      type: String,
      trim: true,
      default: '',
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    maidenName: {
      type: String,
      trim: true,
      default: '',
    },
    dateOfBirth: {
      type: String,
      required: true,
      trim: true,
    },
    sex: {
      type: String,
      required: true,
      trim: true,
    },
    placeOfBirth: {
      type: String,
      trim: true,
      default: '',
    },
    citizenship: {
      type: String,
      trim: true,
      default: '',
    },
    mothersMaidenName: {
      type: String,
      trim: true,
      default: '',
    },
    currentLocation: {
      type: String,
      trim: true,
      default: '',
    },
    phoneCountryCode: {
      type: String,
      trim: true,
      default: '',
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    emailAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    homeCountryAddress: {
      type: String,
      trim: true,
      default: '',
    },
    postalCode: {
      type: String,
      trim: true,
      default: '',
    },
    passportNumber: {
      type: String,
      required: true,
      trim: true,
    },
    passportExpiry: {
      type: String,
      trim: true,
      default: '',
    },
    education: {
      type: String,
      required: true,
      trim: true,
    },
    languageSkills: {
      type: String,
      trim: true,
      default: '',
    },
    profession: {
      type: String,
      trim: true,
      default: '',
    },
    shoeSize: {
      type: String,
      trim: true,
      default: '',
    },
    clothesSize: {
      type: String,
      trim: true,
      default: '',
    },
    signatureAuthenticationAppointment: {
      type: String,
      trim: true,
      default: '',
    },
    dVisaBookingAppointment: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    photo: {
      type: String,
      default: '',
    },
    documents: {
      tor: { type: uploadedDocumentSchema, default: null },
      passport: { type: uploadedDocumentSchema, default: null },
      hkid: { type: uploadedDocumentSchema, default: null },
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export const Applicant = mongoose.model('Applicant', applicantSchema);
