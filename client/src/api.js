const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function parseContentDispositionFileName(contentDisposition) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = /filename="([^"]+)"/.exec(contentDisposition);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  const unquotedMatch = /filename=([^;]+)/.exec(contentDisposition);
  if (unquotedMatch) {
    return unquotedMatch[1].trim();
  }

  return null;
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error(
      `Cannot reach the server at ${API_URL}. If you are running locally, start the backend with "npm run dev:server" and check MONGODB_URI in server/.env.`,
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export function registerUser({ username, password, adminPassword }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, adminPassword }),
  });
}

export function loginUser({ username, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getCurrentUser(token) {
  return request('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getApplicants(token) {
  return request('/api/applicants', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getRegisteredApplicantNames(token) {
  return request('/api/applicants/names', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createApplicant(token, applicant) {
  return request('/api/applicants', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(applicant),
  });
}

export function deleteApplicant(token, applicantId) {
  return request(`/api/applicants/${applicantId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateApplicant(token, applicantId, applicant) {
  return request(`/api/applicants/${applicantId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(applicant),
  });
}

export async function uploadApplicantDocument(token, applicantId, documentType, file) {
  const formData = new FormData();
  formData.append('file', file);

  let response;

  try {
    response = await fetch(`${API_URL}/api/applicants/${applicantId}/documents/${documentType}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch {
    throw new Error(
      `Cannot reach the server at ${API_URL}. If you are running locally, start the backend with "npm run dev:server".`,
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Document upload failed');
  }

  return data;
}

export async function openApplicantDocument(token, applicantId, documentType) {
  let response;

  try {
    response = await fetch(`${API_URL}/api/applicants/${applicantId}/documents/${documentType}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      `Cannot reach the server at ${API_URL}. If you are running locally, start the backend with "npm run dev:server".`,
    );
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to open document');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

export function deleteApplicantDocument(token, applicantId, documentType) {
  return request(`/api/applicants/${applicantId}/documents/${documentType}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getApplicantPayments(token, applicantId) {
  return request(`/api/applicants/${applicantId}/payments`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateApplicantTotalFees(token, applicantId, totalFees) {
  return request(`/api/applicants/${applicantId}/payments/total-fees`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ totalFees }),
  });
}

export function addApplicantPaymentEntry(token, applicantId, paymentEntry) {
  return request(`/api/applicants/${applicantId}/payments/entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(paymentEntry),
  });
}

export function deleteApplicantPaymentEntry(token, applicantId, entryId, adminPassword) {
  return request(`/api/applicants/${applicantId}/payments/entries/${entryId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ adminPassword }),
  });
}

export function clearApplicantPaymentHistory(token, applicantId, adminPassword) {
  return request(`/api/applicants/${applicantId}/payments/history`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ adminPassword }),
  });
}

export async function exportApplicantPaymentsWord(token, applicantId) {
  let response;

  try {
    response = await fetch(`${API_URL}/api/applicants/${applicantId}/payments/export/word`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      `Cannot reach the server at ${API_URL}. If you are running locally, start the backend with "npm run dev:server".`,
    );
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Payment Word export failed');
  }

  const blob = await response.blob();
  const savedPath = response.headers.get('X-CJN-Saved-Path') || '';
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const fileName =
    response.headers.get('X-CJN-Filename')
    || parseContentDispositionFileName(contentDisposition)
    || 'payments.docx';
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

  return { fileName, savedPath };
}

export async function exportApplicantWord(token, applicantId) {
  let response;

  try {
    response = await fetch(`${API_URL}/api/applicants/${applicantId}/export/word`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      `Cannot reach the server at ${API_URL}. If you are running locally, start the backend with "npm run dev:server".`,
    );
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Word export failed');
  }

  const blob = await response.blob();
  const savedPath = response.headers.get('X-CJN-Saved-Path') || '';
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const fileName =
    response.headers.get('X-CJN-Filename')
    || parseContentDispositionFileName(contentDisposition)
    || 'applicant.docx';
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

  return { fileName, savedPath };
}
