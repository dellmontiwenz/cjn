import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createApplicant,
  deleteApplicant,
  deleteApplicantDocument,
  getApplicants,
  getCurrentUser,
  loginUser,
  openApplicantDocument,
  registerUser,
  updateApplicant,
  uploadApplicantDocument,
} from './api.js';
import PageBackground from './PageBackground.jsx';

const inactivityTimeoutMs = 5 * 60 * 1000;

const countryCodes = [
  { code: '+63', label: '+63 Philippines' },
  { code: '+852', label: '+852 Hong Kong' },
  { code: '+853', label: '+853 Macau' },
  { code: '+65', label: '+65 Singapore' },
  { code: '+60', label: '+60 Malaysia' },
  { code: '+886', label: '+886 Taiwan' },
  { code: '+81', label: '+81 Japan' },
  { code: '+82', label: '+82 South Korea' },
  { code: '+86', label: '+86 China' },
  { code: '+971', label: '+971 UAE' },
  { code: '+966', label: '+966 Saudi Arabia' },
  { code: '+974', label: '+974 Qatar' },
  { code: '+973', label: '+973 Bahrain' },
  { code: '+965', label: '+965 Kuwait' },
  { code: '+968', label: '+968 Oman' },
  { code: '+972', label: '+972 Israel' },
  { code: '+962', label: '+962 Jordan' },
  { code: '+961', label: '+961 Lebanon' },
  { code: '+1', label: '+1 USA / Canada' },
  { code: '+44', label: '+44 United Kingdom' },
  { code: '+61', label: '+61 Australia' },
  { code: '+64', label: '+64 New Zealand' },
  { code: '+39', label: '+39 Italy' },
  { code: '+34', label: '+34 Spain' },
  { code: '+49', label: '+49 Germany' },
  { code: '+33', label: '+33 France' },
  { code: '+31', label: '+31 Netherlands' },
  { code: '+41', label: '+41 Switzerland' },
  { code: '+353', label: '+353 Ireland' },
  { code: '+7', label: '+7 Russia' },
];

const defaultApplicantPhoto =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
      '<rect width="160" height="160" fill="#e5e7eb"/>' +
      '<circle cx="80" cy="62" r="30" fill="#9ca3af"/>' +
      '<path d="M30 141c0-27 22-45 50-45s50 18 50 45z" fill="#9ca3af"/>' +
      '</svg>',
  );

const maxPhotoBytes = 2 * 1024 * 1024;

const documentDefinitions = [
  { type: 'tor', label: 'TOR' },
  { type: 'passport', label: 'Passport' },
  { type: 'hkid', label: 'HKID' },
];

const maxDocumentBytes = 10 * 1024 * 1024;
const allowedDocumentMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function emptyPendingDocuments() {
  return {
    tor: null,
    passport: null,
    hkid: null,
  };
}

function validateDocumentFile(file) {
  if (!allowedDocumentMimeTypes.has(file.type)) {
    return 'Only PDF, JPG, PNG, or WEBP files are allowed';
  }

  if (file.size > maxDocumentBytes) {
    return 'Document must be 10 MB or smaller';
  }

  return null;
}

const emptyApplicant = {
  firstName: '',
  middleName: '',
  lastName: '',
  maidenName: '',
  dateOfBirth: '',
  sex: '',
  placeOfBirth: '',
  citizenship: '',
  mothersMaidenName: '',
  currentLocation: '',
  phoneCountryCode: '',
  phoneNumber: '',
  emailAddress: '',
  homeCountryAddress: '',
  postalCode: '',
  passportNumber: '',
  passportExpiry: '',
  education: '',
  languageSkills: '',
  profession: '',
  shoeSize: '',
  clothesSize: '',
  signatureAuthenticationAppointment: '',
  dVisaBookingAppointment: '',
  notes: '',
  photo: '',
};

const applicantSearchFields = [
  'firstName',
  'middleName',
  'lastName',
  'maidenName',
  'dateOfBirth',
  'sex',
  'placeOfBirth',
  'citizenship',
  'mothersMaidenName',
  'currentLocation',
  'phoneCountryCode',
  'phoneNumber',
  'emailAddress',
  'homeCountryAddress',
  'postalCode',
  'passportNumber',
  'passportExpiry',
  'education',
  'languageSkills',
  'profession',
  'shoeSize',
  'clothesSize',
  'signatureAuthenticationAppointment',
  'dVisaBookingAppointment',
  'notes',
];

const duplicateApplicantMessage = 'An applicant with the same full name and email already exists.';

function applicantFullName(applicant) {
  return [applicant.firstName, applicant.middleName, applicant.lastName]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return emailPattern.test(email.trim());
}

function isValidPhoneNumber(phoneNumber) {
  const digitsOnly = phoneNumber.replace(/[\s()-]/g, '').replace(/^\+/, '');
  return /^\d{6,15}$/.test(digitsOnly);
}

function formatDateOfBirth(dateOfBirth) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) {
    return dateOfBirth;
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

const applicantDisplayFields = [
  { label: 'Maiden name', key: 'maidenName' },
  {
    label: 'Date of birth',
    key: 'dateOfBirth',
    format: (applicant) => {
      if (!applicant.dateOfBirth) {
        return '';
      }

      const formatted = formatDateOfBirth(applicant.dateOfBirth);
      const age = calculateAge(applicant.dateOfBirth);
      return age === null ? formatted : `${formatted} (age ${age})`;
    },
  },
  { label: 'Sex', key: 'sex' },
  { label: 'Place of birth', key: 'placeOfBirth' },
  { label: 'Citizenship', key: 'citizenship' },
  { label: "Mother's maiden name", key: 'mothersMaidenName' },
  { label: 'Current location', key: 'currentLocation' },
  {
    label: 'Phone',
    key: 'phoneNumber',
    format: (applicant) =>
      [applicant.phoneCountryCode, applicant.phoneNumber].filter(Boolean).join(' ').trim(),
  },
  { label: 'Email', key: 'emailAddress' },
  { label: 'Home country address', key: 'homeCountryAddress' },
  { label: 'Postal code', key: 'postalCode' },
  { label: 'Passport', key: 'passportNumber' },
  { label: 'Passport expiry', key: 'passportExpiry' },
  { label: 'Education', key: 'education' },
  { label: 'Language skills', key: 'languageSkills' },
  { label: 'Profession', key: 'profession' },
  { label: 'Shoe size', key: 'shoeSize' },
  { label: 'Clothes size', key: 'clothesSize' },
  { label: 'Authentication of Signature appointment', key: 'signatureAuthenticationAppointment' },
  { label: 'D-Visa booking appointment', key: 'dVisaBookingAppointment' },
  { label: 'Notes', key: 'notes' },
];

function applicantToForm(applicant) {
  return {
    firstName: applicant.firstName || '',
    middleName: applicant.middleName || '',
    lastName: applicant.lastName || '',
    maidenName: applicant.maidenName || '',
    dateOfBirth: applicant.dateOfBirth || '',
    sex: applicant.sex || '',
    placeOfBirth: applicant.placeOfBirth || '',
    citizenship: applicant.citizenship || '',
    mothersMaidenName: applicant.mothersMaidenName || '',
    currentLocation: applicant.currentLocation || '',
    phoneCountryCode: applicant.phoneCountryCode || '',
    phoneNumber: applicant.phoneNumber || '',
    emailAddress: applicant.emailAddress || '',
    homeCountryAddress: applicant.homeCountryAddress || '',
    postalCode: applicant.postalCode || '',
    passportNumber: applicant.passportNumber || '',
    passportExpiry: applicant.passportExpiry || '',
    education: applicant.education || '',
    languageSkills: applicant.languageSkills || '',
    profession: applicant.profession || '',
    shoeSize: applicant.shoeSize || '',
    clothesSize: applicant.clothesSize || '',
    signatureAuthenticationAppointment: applicant.signatureAuthenticationAppointment || '',
    dVisaBookingAppointment: applicant.dVisaBookingAppointment || '',
    notes: applicant.notes || '',
    photo: applicant.photo || '',
  };
}

export default function App() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [applicantForm, setApplicantForm] = useState(emptyApplicant);
  const [applicantSearch, setApplicantSearch] = useState('');
  const [lastSavedApplicantId, setLastSavedApplicantId] = useState('');
  const [editingApplicantId, setEditingApplicantId] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingApplicant, setIsSavingApplicant] = useState(false);
  const [uploadingDocumentKey, setUploadingDocumentKey] = useState('');
  const [pendingDocuments, setPendingDocuments] = useState(emptyPendingDocuments);
  const [isRestoringSession, setIsRestoringSession] = useState(() => Boolean(localStorage.getItem('authToken')));
  const inactivityTimerRef = useRef(null);

  function clearPendingDocuments() {
    setPendingDocuments((currentDocuments) => {
      Object.values(currentDocuments).forEach((entry) => {
        if (entry?.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl);
        }
      });

      return emptyPendingDocuments();
    });
  }

  const handleLogout = useCallback(({ dueToInactivity = false } = {}) => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    localStorage.removeItem('authToken');
    setUser(null);
    setToken('');
    setApplicants([]);
    setApplicantSearch('');
    setLastSavedApplicantId('');
    setEditingApplicantId('');
    setActiveTab('create');
    setApplicantForm(emptyApplicant);
    clearPendingDocuments();
    setUsername('');
    setPassword('');
    setAdminPassword('');
    setError('');
    setMessage(dueToInactivity ? 'You were logged out after 5 minutes of inactivity.' : '');
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (!savedToken) {
      setIsRestoringSession(false);
      return;
    }

    async function restoreSession() {
      try {
        const userData = await getCurrentUser(savedToken);
        const applicantData = await getApplicants(savedToken);
        setToken(savedToken);
        setUser(userData.user);
        setApplicants(applicantData.applicants);
      } catch {
        localStorage.removeItem('authToken');
      } finally {
        setIsRestoringSession(false);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      inactivityTimerRef.current = setTimeout(() => {
        handleLogout({ dueToInactivity: true });
      }, inactivityTimeoutMs);
    };

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    resetInactivityTimer();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });
    };
  }, [user, handleLogout]);

  const isLogin = mode === 'login';
  const isEditingApplicant = Boolean(editingApplicantId);
  const editingApplicant = isEditingApplicant
    ? applicants.find((applicant) => applicant.id === editingApplicantId)
    : null;
  const hasApplicantSearch = applicantSearch.trim().length > 0;
  const displayedApplicants = applicants.filter((applicant) => {
    const search = applicantSearch.trim().toLowerCase();
    const fullName = [applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(' ');

    if (!search) {
      return false;
    }

    return [fullName, ...applicantSearchFields.map((field) => applicant[field])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
  const applicantNameSuggestions = applicantSearch.trim()
    ? displayedApplicants
        .map((applicant) => [applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(' '))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const emailInvalid = applicantForm.emailAddress.trim().length > 0 && !isValidEmail(applicantForm.emailAddress);
  const phoneNumberInvalid = applicantForm.phoneNumber.trim().length > 0 && !isValidPhoneNumber(applicantForm.phoneNumber);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    if (!isLogin && !adminPassword) {
      setError('Administration password is required to create an account');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const data = await loginUser({ username, password });
        localStorage.setItem('authToken', data.token);
        setToken(data.token);
        setUser(data.user);
        const applicantData = await getApplicants(data.token);
        setApplicants(applicantData.applicants);
      } else {
        await registerUser({ username, password, adminPassword });
        setMode('login');
        setPassword('');
        setAdminPassword('');
        setMessage('Account created. You can log in now.');
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApplicantSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!isValidEmail(applicantForm.emailAddress)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isValidPhoneNumber(applicantForm.phoneNumber)) {
      setError('Please enter a valid phone number (6 to 15 digits)');
      return;
    }

    const targetName = applicantFullName(applicantForm);
    const targetEmail = applicantForm.emailAddress.trim().toLowerCase();
    const hasDuplicate = applicants.some((applicant) => {
      if (isEditingApplicant && applicant.id === editingApplicantId) {
        return false;
      }

      return applicantFullName(applicant) === targetName && (applicant.emailAddress || '').trim().toLowerCase() === targetEmail;
    });

    if (hasDuplicate) {
      setError(duplicateApplicantMessage);
      return;
    }

    setIsSavingApplicant(true);

    try {
      if (isEditingApplicant) {
        const data = await updateApplicant(token, editingApplicantId, applicantForm);
        setApplicants((currentApplicants) =>
          currentApplicants.map((currentApplicant) =>
            currentApplicant.id === editingApplicantId ? data.applicant : currentApplicant,
          ),
        );
        setLastSavedApplicantId(data.applicant.id);
        setApplicantForm(applicantToForm(data.applicant));
        setActiveTab('create');
        setMessage('Applicant updated.');
      } else {
        const data = await createApplicant(token, applicantForm);
        let savedApplicant = data.applicant;
        let uploadedCount = 0;

        for (const { type } of documentDefinitions) {
          const pendingEntry = pendingDocuments[type];
          if (!pendingEntry?.file) {
            continue;
          }

          const uploadData = await uploadApplicantDocument(token, savedApplicant.id, type, pendingEntry.file);
          savedApplicant = { ...savedApplicant, documents: uploadData.documents };
          uploadedCount += 1;
        }

        clearPendingDocuments();
        setApplicants((currentApplicants) => [savedApplicant, ...currentApplicants]);
        setLastSavedApplicantId(savedApplicant.id);
        setEditingApplicantId(savedApplicant.id);
        setApplicantForm(applicantToForm(savedApplicant));
        setActiveTab('create');
        setMessage(
          uploadedCount > 0
            ? `Applicant saved with ${uploadedCount} document${uploadedCount === 1 ? '' : 's'}.`
            : 'Applicant saved.',
        );
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSavingApplicant(false);
    }
  }

  async function handleDeleteApplicant(applicant) {
    setError('');
    setMessage('');

    try {
      await deleteApplicant(token, applicant.id);
      setApplicants((currentApplicants) => currentApplicants.filter((currentApplicant) => currentApplicant.id !== applicant.id));
      if (lastSavedApplicantId === applicant.id) {
        setLastSavedApplicantId('');
      }
      if (editingApplicantId === applicant.id) {
        setEditingApplicantId('');
        setApplicantForm(emptyApplicant);
      }
      setMessage('Applicant deleted from MongoDB.');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function handleEditApplicant(applicant) {
    setError('');
    setMessage('');
    clearPendingDocuments();
    setEditingApplicantId(applicant.id);
    setApplicantForm(applicantToForm(applicant));
    setActiveTab('create');
  }

  function handleCancelEdit() {
    setEditingApplicantId('');
    setApplicantForm(emptyApplicant);
    clearPendingDocuments();
    setError('');
    setMessage('');
  }

  function updateApplicantField(field, value) {
    setApplicantForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function readPhotoFile(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file for the photo.');
    }

    if (file.size > maxPhotoBytes) {
      throw new Error('Photo must be 2 MB or smaller.');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read the selected photo. Please try again.'));
      reader.readAsDataURL(file);
    });
  }

  function handlePhotoChange(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setError('');
    readPhotoFile(file)
      .then((photo) => updateApplicantField('photo', photo))
      .catch((photoError) => setError(photoError.message));
  }

  function handleRemovePhoto() {
    updateApplicantField('photo', '');
  }

  async function saveApplicantPhoto(applicant, photo) {
    setError('');
    setMessage('');
    setIsSavingApplicant(true);

    try {
      const data = await updateApplicant(token, applicant.id, {
        ...applicantToForm(applicant),
        photo,
      });
      setApplicants((currentApplicants) =>
        currentApplicants.map((currentApplicant) =>
          currentApplicant.id === applicant.id ? data.applicant : currentApplicant,
        ),
      );
      if (editingApplicantId === applicant.id) {
        updateApplicantField('photo', photo);
      }
      setMessage(photo ? 'Applicant photo updated.' : 'Applicant photo removed.');
    } catch (photoError) {
      setError(photoError.message);
    } finally {
      setIsSavingApplicant(false);
    }
  }

  async function handleCardPhotoChange(applicant, event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const photo = await readPhotoFile(file);
      await saveApplicantPhoto(applicant, photo);
    } catch (photoError) {
      setError(photoError.message);
    }
  }

  async function handleCardPhotoRemove(applicant) {
    await saveApplicantPhoto(applicant, '');
  }

  function updateApplicantDocuments(applicantId, documents) {
    setApplicants((currentApplicants) =>
      currentApplicants.map((currentApplicant) =>
        currentApplicant.id === applicantId ? { ...currentApplicant, documents } : currentApplicant,
      ),
    );
  }

  async function handleFormDocumentUpload(documentType, event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const validationError = validateDocumentFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const label = documentDefinitions.find((document) => document.type === documentType)?.label || documentType;
    setError('');
    setMessage('');

    if (editingApplicant) {
      await handleDocumentUpload(editingApplicant, documentType, { target: { files: [file], value: '' } });
      return;
    }

    setPendingDocuments((currentDocuments) => {
      const nextDocuments = { ...currentDocuments };
      if (nextDocuments[documentType]?.objectUrl) {
        URL.revokeObjectURL(nextDocuments[documentType].objectUrl);
      }

      nextDocuments[documentType] = {
        file,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        objectUrl: URL.createObjectURL(file),
      };

      return nextDocuments;
    });
    setMessage(`${label} selected. It will upload when you save the applicant.`);
  }

  async function handleFormDocumentView(documentType) {
    if (editingApplicant?.documents?.[documentType]?.uploaded) {
      await handleViewDocument(editingApplicant, documentType);
      return;
    }

    const pendingEntry = pendingDocuments[documentType];
    if (pendingEntry?.objectUrl) {
      window.open(pendingEntry.objectUrl, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleFormDocumentDelete(documentType) {
    const label = documentDefinitions.find((document) => document.type === documentType)?.label || documentType;

    if (editingApplicant?.documents?.[documentType]?.uploaded) {
      await handleDeleteDocument(editingApplicant, documentType);
      return;
    }

    setPendingDocuments((currentDocuments) => {
      const nextDocuments = { ...currentDocuments };
      if (nextDocuments[documentType]?.objectUrl) {
        URL.revokeObjectURL(nextDocuments[documentType].objectUrl);
      }

      nextDocuments[documentType] = null;
      return nextDocuments;
    });
    setMessage(`${label} removed.`);
  }

  async function handleDocumentUpload(applicant, documentType, event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const uploadKey = `${applicant.id}-${documentType}`;
    setError('');
    setMessage('');
    setUploadingDocumentKey(uploadKey);

    try {
      const data = await uploadApplicantDocument(token, applicant.id, documentType, file);
      updateApplicantDocuments(applicant.id, data.documents);
      const label = documentDefinitions.find((document) => document.type === documentType)?.label || documentType;
      setMessage(`${label} uploaded.`);
    } catch (documentError) {
      setError(documentError.message);
    } finally {
      setUploadingDocumentKey('');
    }
  }

  async function handleViewDocument(applicant, documentType) {
    setError('');
    setMessage('');

    try {
      await openApplicantDocument(token, applicant.id, documentType);
    } catch (documentError) {
      setError(documentError.message);
    }
  }

  async function handleDeleteDocument(applicant, documentType) {
    const label = documentDefinitions.find((document) => document.type === documentType)?.label || documentType;
    const displayName = [applicant.firstName, applicant.middleName, applicant.lastName]
      .filter(Boolean)
      .join(' ');
    const confirmed = window.confirm(`Delete ${label} for ${displayName}?`);

    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');
    setUploadingDocumentKey(`${applicant.id}-${documentType}`);

    try {
      const data = await deleteApplicantDocument(token, applicant.id, documentType);
      updateApplicantDocuments(applicant.id, data.documents);
      setMessage(`${label} deleted.`);
    } catch (documentError) {
      setError(documentError.message);
    } finally {
      setUploadingDocumentKey('');
    }
  }

  if (isRestoringSession) {
    return (
      <>
        <PageBackground />
        <main className="page-shell">
          <section className="auth-card">
            <p className="subtitle">Restoring your session...</p>
          </section>
        </main>
      </>
    );
  }

  if (user) {
    return (
      <>
        <PageBackground />
        <main className="page-shell dashboard-shell">
        <section className="dashboard-panel">
          <div className="dashboard-header">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h1>Applicant Dashboard</h1>
              <p>You are logged in as {user.username}{user.isAdmin ? ' (Admin)' : ''}.</p>
            </div>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>

          <div className="dashboard-tabs" role="tablist">
            <button
              type="button"
              className={activeTab === 'create' ? 'tab-button active' : 'tab-button'}
              onClick={() => setActiveTab('create')}
            >
              {isEditingApplicant ? 'Edit Applicant' : 'Create New Applicant'}
            </button>
            <button
              type="button"
              className={activeTab === 'search' ? 'tab-button active' : 'tab-button'}
              onClick={() => setActiveTab('search')}
            >
              Search Applicants
            </button>
          </div>

          <div className="applicant-search dashboard-search">
            <label htmlFor="applicantSearch">Search applicant</label>
            <div className="applicant-search-row">
              <input
                id="applicantSearch"
                value={applicantSearch}
                onChange={(event) => {
                  setApplicantSearch(event.target.value);
                  if (event.target.value.trim()) {
                    setActiveTab('search');
                  }
                }}
                placeholder="Search name, passport, email, phone, location"
              />
            </div>
            {applicantNameSuggestions.length > 0 && (
              <div className="applicant-suggestions" aria-label="Applicant name suggestions">
                {applicantNameSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    className="suggestion-button"
                    key={suggestion}
                    onClick={() => {
                      setApplicantSearch(suggestion);
                      setActiveTab('search');
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-content">
            {activeTab === 'create' && (
            <form className="applicant-form" onSubmit={handleApplicantSubmit}>
              <h2>{isEditingApplicant ? 'Edit Applicant' : 'Create New Applicant'}</h2>

              <p className="form-section-label">Photo</p>
              <div className="photo-upload">
                <img
                  className="photo-preview"
                  src={applicantForm.photo || defaultApplicantPhoto}
                  alt="Applicant photo preview"
                />
                <div className="photo-upload-controls">
                  <label htmlFor="photo" className="photo-upload-label">
                    {applicantForm.photo ? 'Change photo' : 'Upload photo'}
                  </label>
                  <input
                    id="photo"
                    type="file"
                    accept="image/*"
                    className="photo-input"
                    onChange={handlePhotoChange}
                  />
                  {applicantForm.photo && (
                    <button type="button" className="secondary-button" onClick={handleRemovePhoto}>
                      Remove photo
                    </button>
                  )}
                  <p className="optional-hint">
                    JPG or PNG, up to 2 MB. Use Change photo to replace it, or Remove photo to use the default.
                    {isEditingApplicant ? ' Click Update applicant to save photo changes from this form.' : ''}
                  </p>
                </div>
              </div>

              <p className="form-section-label">Documents (TOR, Passport, HKID)</p>
              <section className="applicant-documents applicant-documents-form">
                {documentDefinitions.map(({ type, label }) => {
                  const serverEntry = editingApplicant?.documents?.[type];
                  const pendingEntry = pendingDocuments[type];
                  const isUploaded = Boolean(serverEntry?.uploaded || pendingEntry);
                  const uploadKey = editingApplicant ? `${editingApplicant.id}-${type}` : `new-${type}`;
                  const isUploading = uploadingDocumentKey === uploadKey;
                  const statusLabel = isUploading
                    ? 'Working...'
                    : serverEntry?.uploaded
                      ? 'Uploaded'
                      : pendingEntry
                        ? 'Ready to upload'
                        : 'Not uploaded';

                  return (
                    <div className="document-row" key={type}>
                      <div className="document-row-info">
                        <span className="document-label">{label}</span>
                        <span className={`document-status ${isUploaded ? 'uploaded' : 'missing'}`}>{statusLabel}</span>
                        {(serverEntry?.originalName || pendingEntry?.originalName) && (
                          <span className="document-meta">
                            {serverEntry?.originalName || pendingEntry?.originalName}
                          </span>
                        )}
                      </div>
                      <div className="document-row-actions">
                        <label htmlFor={`form-doc-${type}-${editingApplicant?.id || 'new'}`} className="photo-upload-label">
                          {isUploaded ? 'Replace' : 'Upload'}
                        </label>
                        <input
                          id={`form-doc-${type}-${editingApplicant?.id || 'new'}`}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          className="photo-input"
                          disabled={isUploading || isSavingApplicant}
                          onChange={(event) => handleFormDocumentUpload(type, event)}
                        />
                        {isUploaded && (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={isUploading || isSavingApplicant}
                              onClick={() => handleFormDocumentView(type)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              disabled={isUploading || isSavingApplicant}
                              onClick={() => handleFormDocumentDelete(type)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <p className="optional-hint">
                  PDF, JPG, PNG, or WEBP, up to 10 MB each. Upload anytime; new applicants upload documents when you save.
                </p>
              </section>

              <p className="form-section-label">Personal Information</p>
              <div className="form-grid">

                <div className="form-field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    value={applicantForm.firstName}
                    onChange={(event) => updateApplicantField('firstName', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="middleName">
                    Middle name <span className="optional-hint">(optional)</span>
                  </label>
                  <input
                    id="middleName"
                    value={applicantForm.middleName}
                    onChange={(event) => updateApplicantField('middleName', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    value={applicantForm.lastName}
                    onChange={(event) => updateApplicantField('lastName', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="maidenName">Maiden name</label>
                  <input
                    id="maidenName"
                    value={applicantForm.maidenName}
                    onChange={(event) => updateApplicantField('maidenName', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="dateOfBirth">Date of birth</label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    value={applicantForm.dateOfBirth}
                    onChange={(event) => updateApplicantField('dateOfBirth', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="sex">Sex</label>
                  <select
                    id="sex"
                    value={applicantForm.sex}
                    onChange={(event) => updateApplicantField('sex', event.target.value)}
                  >
                    <option value="">Select sex</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="placeOfBirth">Place of birth</label>
                  <input
                    id="placeOfBirth"
                    value={applicantForm.placeOfBirth}
                    onChange={(event) => updateApplicantField('placeOfBirth', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="citizenship">Citizenship</label>
                  <input
                    id="citizenship"
                    value={applicantForm.citizenship}
                    onChange={(event) => updateApplicantField('citizenship', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="mothersMaidenName">Mother&apos;s maiden name</label>
                  <input
                    id="mothersMaidenName"
                    value={applicantForm.mothersMaidenName}
                    onChange={(event) => updateApplicantField('mothersMaidenName', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="currentLocation">Current location</label>
                  <input
                    id="currentLocation"
                    value={applicantForm.currentLocation}
                    onChange={(event) => updateApplicantField('currentLocation', event.target.value)}
                  />
                </div>
              </div>

              <p className="form-section-label">Contact Information</p>
              <div className="form-grid">
                <div className="form-field form-field-phone">
                  <label htmlFor="phoneNumber">Phone number</label>
                  <div className="phone-input-row">
                    <select
                      id="phoneCountryCode"
                      aria-label="Country code"
                      className="phone-country-code"
                      value={applicantForm.phoneCountryCode}
                      onChange={(event) => updateApplicantField('phoneCountryCode', event.target.value)}
                    >
                      <option value="">Code</option>
                      {countryCodes.map((entry) => (
                        <option key={entry.label} value={entry.code}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                    <input
                      id="phoneNumber"
                      inputMode="tel"
                      placeholder="Mobile number"
                      aria-invalid={phoneNumberInvalid}
                      className={phoneNumberInvalid ? 'input-invalid' : undefined}
                      value={applicantForm.phoneNumber}
                      onChange={(event) => updateApplicantField('phoneNumber', event.target.value)}
                    />
                  </div>
                  {phoneNumberInvalid && (
                    <p className="field-error">Enter 6 to 15 digits (numbers only).</p>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="emailAddress">Email address</label>
                  <input
                    id="emailAddress"
                    type="email"
                    aria-invalid={emailInvalid}
                    className={emailInvalid ? 'input-invalid' : undefined}
                    value={applicantForm.emailAddress}
                    onChange={(event) => updateApplicantField('emailAddress', event.target.value)}
                  />
                  {emailInvalid && <p className="field-error">Enter a valid email like name@example.com.</p>}
                </div>

                <div className="form-field form-field-full">
                  <label htmlFor="homeCountryAddress">Home country address</label>
                  <textarea
                    id="homeCountryAddress"
                    rows="2"
                    value={applicantForm.homeCountryAddress}
                    onChange={(event) => updateApplicantField('homeCountryAddress', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="postalCode">Postal code</label>
                  <input
                    id="postalCode"
                    value={applicantForm.postalCode}
                    onChange={(event) => updateApplicantField('postalCode', event.target.value)}
                  />
                </div>
              </div>

              <p className="form-section-label">Passport &amp; Travel</p>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="passportNumber">Passport number</label>
                  <input
                    id="passportNumber"
                    value={applicantForm.passportNumber}
                    onChange={(event) => updateApplicantField('passportNumber', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="passportExpiry">Passport expiry</label>
                  <input
                    id="passportExpiry"
                    type="date"
                    value={applicantForm.passportExpiry}
                    onChange={(event) => updateApplicantField('passportExpiry', event.target.value)}
                  />
                </div>
              </div>

              <p className="form-section-label">Education &amp; Skills</p>
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="education">Education</label>
                  <textarea
                    id="education"
                    rows="3"
                    value={applicantForm.education}
                    onChange={(event) => updateApplicantField('education', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="languageSkills">Language skills</label>
                  <input
                    id="languageSkills"
                    value={applicantForm.languageSkills}
                    onChange={(event) => updateApplicantField('languageSkills', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="profession">Profession</label>
                  <input
                    id="profession"
                    value={applicantForm.profession}
                    onChange={(event) => updateApplicantField('profession', event.target.value)}
                  />
                </div>
              </div>

              <p className="form-section-label">Uniform Sizing</p>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="shoeSize">Shoe size</label>
                  <input
                    id="shoeSize"
                    value={applicantForm.shoeSize}
                    onChange={(event) => updateApplicantField('shoeSize', event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="clothesSize">Clothes size</label>
                  <input
                    id="clothesSize"
                    value={applicantForm.clothesSize}
                    onChange={(event) => updateApplicantField('clothesSize', event.target.value)}
                  />
                </div>
              </div>

              <p className="form-section-label">Hungary Appointments</p>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="signatureAuthenticationAppointment">Authentication of Signature appointment?</label>
                  <select
                    id="signatureAuthenticationAppointment"
                    value={applicantForm.signatureAuthenticationAppointment}
                    onChange={(event) => updateApplicantField('signatureAuthenticationAppointment', event.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="dVisaBookingAppointment">D-Visa booking appointment?</label>
                  <select
                    id="dVisaBookingAppointment"
                    value={applicantForm.dVisaBookingAppointment}
                    onChange={(event) => updateApplicantField('dVisaBookingAppointment', event.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              <p className="form-section-label">Notes &amp; Discrepancies</p>
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="notes">
                    Notes <span className="optional-hint">(requirements, missing documents, data discrepancies)</span>
                  </label>
                  <textarea
                    id="notes"
                    rows="4"
                    placeholder="e.g. Passport scan pending, birth certificate name spelled differently..."
                    value={applicantForm.notes}
                    onChange={(event) => updateApplicantField('notes', event.target.value)}
                  />
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}
              {message && <p className="form-success">{message}</p>}

              <div className="form-actions">
                {isEditingApplicant && (
                  <button type="button" className="secondary-button" onClick={handleCancelEdit}>
                    Cancel edit
                  </button>
                )}
                <button type="submit" disabled={isSavingApplicant}>
                  {isSavingApplicant ? 'Saving...' : isEditingApplicant ? 'Update applicant' : 'Save applicant'}
                </button>
              </div>
            </form>
            )}

            {activeTab === 'search' && (
            <section className="applicant-list" aria-label="Applicant search results">
              <h2>Search Applicants</h2>
              {error && <p className="form-error">{error}</p>}
              {message && <p className="form-success">{message}</p>}
              {displayedApplicants.length === 0 ? (
                <p className="empty-state">
                  {hasApplicantSearch
                    ? 'No matching applicants found.'
                    : 'Enter a name, passport, email, or phone to search applicants.'}
                </p>
              ) : (
                <div className="applicant-cards">
                  {displayedApplicants.map((applicant) => (
                    <article className="applicant-card" key={applicant.id}>
                      <img
                        className="applicant-photo"
                        src={applicant.photo || defaultApplicantPhoto}
                        alt={`${[applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(' ')} photo`}
                      />
                      <div className="applicant-photo-actions">
                        <label htmlFor={`photo-${applicant.id}`} className="photo-upload-label">
                          {applicant.photo ? 'Change photo' : 'Upload photo'}
                        </label>
                        <input
                          id={`photo-${applicant.id}`}
                          type="file"
                          accept="image/*"
                          className="photo-input"
                          disabled={isSavingApplicant}
                          onChange={(event) => handleCardPhotoChange(applicant, event)}
                        />
                        {applicant.photo && (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isSavingApplicant}
                            onClick={() => handleCardPhotoRemove(applicant)}
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                      <h3>
                        {[applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(' ')}
                      </h3>
                      {applicantDisplayFields.map(({ label, key, format }) => {
                        const value = format ? format(applicant) : applicant[key];
                        if (!value) {
                          return null;
                        }

                        return (
                          <p key={key} className={key === 'notes' ? 'applicant-notes' : undefined}>
                            <strong>{label}:</strong> {value}
                          </p>
                        );
                      })}
                      {documentDefinitions.some(({ type }) => applicant.documents?.[type]?.uploaded) && (
                        <section className="applicant-documents">
                          {documentDefinitions.map(({ type, label }) => {
                            const documentEntry = applicant.documents?.[type];
                            if (!documentEntry?.uploaded) {
                              return null;
                            }

                            return (
                              <div className="document-row" key={type}>
                                <div className="document-row-info">
                                  <span className="document-label">{label}</span>
                                  <span className="document-status uploaded">Uploaded</span>
                                  <span className="document-meta">{documentEntry.originalName}</span>
                                </div>
                                <div className="document-row-actions">
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={uploadingDocumentKey === `${applicant.id}-${type}` || isSavingApplicant}
                                    onClick={() => handleViewDocument(applicant, type)}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="danger-button"
                                    disabled={uploadingDocumentKey === `${applicant.id}-${type}` || isSavingApplicant}
                                    onClick={() => handleDeleteDocument(applicant, type)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </section>
                      )}
                      <div className="applicant-card-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleEditApplicant(applicant)}
                        >
                          Edit {[applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(' ')}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleDeleteApplicant(applicant)}
                        >
                          Delete {[applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(' ')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            )}
          </div>
        </section>
      </main>
      </>
    );
  }

  return (
    <>
      <PageBackground />
      <main className="page-shell">
      <section className="auth-card">
        <p className="eyebrow">CJN Studio</p>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="subtitle">
          {isLogin
            ? 'Log in to continue to your workspace.'
            : 'Enter an administration password to create a new user account.'}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
          />

          {!isLogin && (
            <>
              <label htmlFor="adminPassword">Administration password</label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Enter the administration password"
              />
            </>
          )}

          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="switch-text">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(isLogin ? 'register' : 'login');
              setAdminPassword('');
              setError('');
              setMessage('');
            }}
          >
            {isLogin ? 'Create one' : 'Log in'}
          </button>
        </p>
      </section>
    </main>
    </>
  );
}
