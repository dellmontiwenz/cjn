import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

function line(fullText) {
  return (content, element) =>
    element?.tagName?.toLowerCase() === 'p' &&
    element.textContent.replace(/\s+/g, ' ').trim() === fullText;
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('shows the login form by default', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
});

test('shows validation when login fields are empty', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: /log in/i }));

  expect(screen.getByText('Username and password are required')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test('logs in and shows the authenticated user', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applicants: [] }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await waitFor(() => {
    expect(screen.getByText('You are logged in as wendell.')).toBeInTheDocument();
  });
  expect(localStorage.getItem('authToken')).toBe('abc123');
});

test('loads saved applicants after login but hides them until searched', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicants: [
          {
            id: 'applicant-1',
            firstName: 'Maria',
            middleName: 'Santos',
            lastName: 'Reyes',
            dateOfBirth: '1997-05-20',
            sex: 'Female',
            phoneNumber: '+639171234567',
            emailAddress: 'maria@example.com',
            passportNumber: 'P1234567',
            education: 'Bachelor of Science in Nursing',
          },
        ],
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await waitFor(() => {
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:5001/api/applicants',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer abc123',
        }),
      }),
    );
  });
  expect(screen.queryByText('Maria Santos Reyes')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /search applicants/i }));

  expect(screen.queryByText('Maria Santos Reyes')).not.toBeInTheDocument();
  expect(screen.getByText('Search for an applicant to show saved details.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /show\/retrieve applicants/i })).not.toBeInTheDocument();
});

test('dynamically searches applicants and suggests matching names', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicants: [
          {
            id: 'applicant-1',
            firstName: 'Maria',
            middleName: 'Santos',
            lastName: 'Reyes',
            dateOfBirth: '1997-05-20',
            sex: 'Female',
            phoneNumber: '+639171234567',
            emailAddress: 'maria@example.com',
            passportNumber: 'P1234567',
            education: 'Bachelor of Science in Nursing',
          },
          {
            id: 'applicant-2',
            firstName: 'Juan',
            middleName: 'Dela',
            lastName: 'Cruz',
            dateOfBirth: '1994-08-15',
            sex: 'Male',
            phoneNumber: '+639181234567',
            emailAddress: 'juan@example.com',
            passportNumber: 'P7654321',
            education: 'Bachelor of Science in Engineering',
          },
        ],
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await waitFor(() => {
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:5001/api/applicants',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer abc123',
        }),
      }),
    );
  });
  expect(screen.queryByText('Maria Santos Reyes')).not.toBeInTheDocument();
  expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument();

  await user.type(screen.getByLabelText(/search applicant/i), 'Mar');

  expect(screen.getAllByText('Maria Santos Reyes')).toHaveLength(2);
  expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^maria santos reyes$/i })).toBeInTheDocument();
});

test('shows applicant information when a suggested applicant name is clicked', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicants: [
          {
            id: 'applicant-1',
            firstName: 'Maria',
            middleName: 'Santos',
            lastName: 'Reyes',
            dateOfBirth: '1997-05-20',
            sex: 'Female',
            phoneNumber: '+639171234567',
            emailAddress: 'maria@example.com',
            passportNumber: 'P1234567',
            education: 'Bachelor of Science in Nursing',
          },
          {
            id: 'applicant-2',
            firstName: 'Juan',
            middleName: 'Dela',
            lastName: 'Cruz',
            dateOfBirth: '1994-08-15',
            sex: 'Male',
            phoneNumber: '+639181234567',
            emailAddress: 'juan@example.com',
            passportNumber: 'P7654321',
            education: 'Bachelor of Science in Engineering',
          },
        ],
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));
  await waitFor(() => {
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:5001/api/applicants',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer abc123',
        }),
      }),
    );
  });

  await user.type(screen.getByLabelText(/search applicant/i), 'Ju');
  await user.click(screen.getByRole('button', { name: /^juan dela cruz$/i }));

  expect(screen.getByLabelText(/search applicant/i)).toHaveValue('Juan Dela Cruz');
  expect(screen.getAllByText('Juan Dela Cruz')).toHaveLength(2);
  expect(screen.getByText(line('Passport: P7654321'))).toBeInTheDocument();
  expect(screen.getByText(line('Education: Bachelor of Science in Engineering'))).toBeInTheDocument();
  expect(screen.queryByText('Maria Santos Reyes')).not.toBeInTheDocument();
});

test('deletes a searched applicant from MongoDB and removes it from results', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicants: [
          {
            id: 'applicant-1',
            firstName: 'Maria',
            middleName: 'Santos',
            lastName: 'Reyes',
            dateOfBirth: '1997-05-20',
            sex: 'Female',
            phoneNumber: '+639171234567',
            emailAddress: 'maria@example.com',
            passportNumber: 'P1234567',
            education: 'Bachelor of Science in Nursing',
          },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Applicant deleted successfully' }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));
  await user.type(await screen.findByLabelText(/search applicant/i), 'Maria');

  await screen.findByText(line('Passport: P1234567'));
  await user.click(screen.getByRole('button', { name: /delete maria santos reyes/i }));

  await waitFor(() => {
    expect(screen.queryByText('Maria Santos Reyes')).not.toBeInTheDocument();
  });
  expect(screen.getByText('No matching applicants found.')).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith(
    'http://localhost:5001/api/applicants/applicant-1',
    expect.objectContaining({
      method: 'DELETE',
      headers: expect.objectContaining({
        Authorization: 'Bearer abc123',
      }),
    }),
  );
});

test('creates an applicant and shows saved applicant information', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applicants: [] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicant: {
          id: 'applicant-1',
          firstName: 'Maria',
          middleName: 'Santos',
          lastName: 'Reyes',
          dateOfBirth: '1997-05-20',
          sex: 'Female',
          phoneNumber: '+639171234567',
          emailAddress: 'maria@example.com',
          passportNumber: 'P1234567',
          education: 'Bachelor of Science in Nursing',
        },
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await screen.findByRole('heading', { name: /applicant dashboard/i });

  await user.type(screen.getByLabelText(/first name/i), 'Maria');
  await user.type(screen.getByLabelText(/middle name/i), 'Santos');
  await user.type(screen.getByLabelText(/last name/i), 'Reyes');
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1997-05-20' } });
  await user.selectOptions(screen.getByLabelText(/sex/i), 'Female');
  await user.type(screen.getByLabelText(/phone number/i), '+639171234567');
  await user.type(screen.getByLabelText(/email address/i), 'maria@example.com');
  await user.type(screen.getByLabelText(/passport number/i), 'P1234567');
  await user.type(screen.getByLabelText(/^education$/i), 'Bachelor of Science in Nursing');
  await user.click(screen.getByRole('button', { name: /save applicant/i }));

  await waitFor(() => {
    expect(screen.getByText('Maria Santos Reyes')).toBeInTheDocument();
  });
  expect(screen.getByText(line('Passport: P1234567'))).toBeInTheDocument();
  expect(screen.getByText(line('Education: Bachelor of Science in Nursing'))).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith(
    'http://localhost:5001/api/applicants',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer abc123',
        'Content-Type': 'application/json',
      }),
    }),
  );
});

test('creates an applicant with a country code prefixed to the phone number', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applicants: [] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicant: {
          id: 'applicant-1',
          firstName: 'Anna',
          lastName: 'Wong',
          dateOfBirth: '1995-03-10',
          sex: 'Female',
          phoneCountryCode: '+852',
          phoneNumber: '98765432',
          emailAddress: 'anna@example.com',
          passportNumber: 'HK998877',
          education: 'Bachelor of Arts',
        },
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await screen.findByRole('heading', { name: /applicant dashboard/i });

  await user.type(screen.getByLabelText(/first name/i), 'Anna');
  await user.type(screen.getByLabelText(/last name/i), 'Wong');
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1995-03-10' } });
  await user.selectOptions(screen.getByLabelText(/sex/i), 'Female');
  await user.selectOptions(screen.getByLabelText(/country code/i), '+852');
  await user.type(screen.getByLabelText(/phone number/i), '98765432');
  await user.type(screen.getByLabelText(/email address/i), 'anna@example.com');
  await user.type(screen.getByLabelText(/passport number/i), 'HK998877');
  await user.type(screen.getByLabelText(/^education$/i), 'Bachelor of Arts');
  await user.click(screen.getByRole('button', { name: /save applicant/i }));

  await waitFor(() => {
    expect(screen.getByText('Anna Wong')).toBeInTheDocument();
  });
  expect(screen.getByText(line('Phone: +852 98765432'))).toBeInTheDocument();

  const [, createOptions] = fetch.mock.calls.at(-1);
  const body = JSON.parse(createOptions.body);
  expect(body.phoneCountryCode).toBe('+852');
  expect(body.phoneNumber).toBe('98765432');
});

test('saves Hungary appointment yes/no answers and shows them', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applicants: [] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicant: {
          id: 'applicant-1',
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
        },
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await screen.findByRole('heading', { name: /applicant dashboard/i });

  await user.type(screen.getByLabelText(/first name/i), 'Maria');
  await user.type(screen.getByLabelText(/last name/i), 'Reyes');
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1997-05-20' } });
  await user.selectOptions(screen.getByLabelText(/sex/i), 'Female');
  await user.type(screen.getByLabelText(/phone number/i), '9171234567');
  await user.type(screen.getByLabelText(/email address/i), 'maria@example.com');
  await user.type(screen.getByLabelText(/passport number/i), 'P1234567');
  await user.type(screen.getByLabelText(/^education$/i), 'Bachelor of Science in Nursing');
  await user.selectOptions(screen.getByLabelText(/authentication of signature appointment/i), 'Yes');
  await user.selectOptions(screen.getByLabelText(/d-visa booking appointment/i), 'No');
  await user.click(screen.getByRole('button', { name: /save applicant/i }));

  await waitFor(() => {
    expect(screen.getByText('Maria Reyes')).toBeInTheDocument();
  });
  expect(screen.getByText(line('Authentication of Signature appointment: Yes'))).toBeInTheDocument();
  expect(screen.getByText(line('D-Visa booking appointment: No'))).toBeInTheDocument();

  const [, createOptions] = fetch.mock.calls.at(-1);
  const body = JSON.parse(createOptions.body);
  expect(body.signatureAuthenticationAppointment).toBe('Yes');
  expect(body.dVisaBookingAppointment).toBe('No');
});

test('saves notes about applicant requirements and shows them', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applicants: [] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicant: {
          id: 'applicant-1',
          firstName: 'Maria',
          lastName: 'Reyes',
          dateOfBirth: '1997-05-20',
          sex: 'Female',
          phoneNumber: '9171234567',
          emailAddress: 'maria@example.com',
          passportNumber: 'P1234567',
          education: 'Bachelor of Science in Nursing',
          notes: 'Passport scan pending. Surname spelled differently on birth certificate.',
        },
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await screen.findByRole('heading', { name: /applicant dashboard/i });

  await user.type(screen.getByLabelText(/first name/i), 'Maria');
  await user.type(screen.getByLabelText(/last name/i), 'Reyes');
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1997-05-20' } });
  await user.selectOptions(screen.getByLabelText(/sex/i), 'Female');
  await user.type(screen.getByLabelText(/phone number/i), '9171234567');
  await user.type(screen.getByLabelText(/email address/i), 'maria@example.com');
  await user.type(screen.getByLabelText(/passport number/i), 'P1234567');
  await user.type(screen.getByLabelText(/^education$/i), 'Bachelor of Science in Nursing');
  await user.type(
    screen.getByLabelText(/^notes/i),
    'Passport scan pending. Surname spelled differently on birth certificate.',
  );
  await user.click(screen.getByRole('button', { name: /save applicant/i }));

  await waitFor(() => {
    expect(screen.getByText('Maria Reyes')).toBeInTheDocument();
  });
  expect(
    screen.getByText(line('Notes: Passport scan pending. Surname spelled differently on birth certificate.')),
  ).toBeInTheDocument();

  const [, createOptions] = fetch.mock.calls.at(-1);
  const body = JSON.parse(createOptions.body);
  expect(body.notes).toBe('Passport scan pending. Surname spelled differently on birth certificate.');
});

test('blocks saving a duplicate full name and email and prompts the user', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicants: [
          {
            id: 'applicant-1',
            firstName: 'Maria',
            middleName: 'Santos',
            lastName: 'Reyes',
            dateOfBirth: '1997-05-20',
            sex: 'Female',
            phoneNumber: '9171234567',
            emailAddress: 'maria@example.com',
            passportNumber: 'P1234567',
            education: 'Bachelor of Science in Nursing',
          },
        ],
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await screen.findByRole('heading', { name: /create new applicant/i });

  await user.type(screen.getByLabelText(/first name/i), 'Maria');
  await user.type(screen.getByLabelText(/middle name/i), 'Santos');
  await user.type(screen.getByLabelText(/last name/i), 'Reyes');
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1997-05-20' } });
  await user.selectOptions(screen.getByLabelText(/sex/i), 'Female');
  await user.type(screen.getByLabelText(/phone number/i), '9171234567');
  await user.type(screen.getByLabelText(/email address/i), 'maria@example.com');
  await user.type(screen.getByLabelText(/passport number/i), 'P7654321');
  await user.type(screen.getByLabelText(/^education$/i), 'Bachelor of Science in Nursing');
  await user.click(screen.getByRole('button', { name: /save applicant/i }));

  expect(screen.getByText('An applicant with the same full name and email already exists.')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('edits a searched applicant and appends new information', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicants: [
          {
            id: 'applicant-1',
            firstName: 'Maria',
            middleName: 'Santos',
            lastName: 'Reyes',
            dateOfBirth: '1997-05-20',
            sex: 'Female',
            phoneNumber: '+639171234567',
            emailAddress: 'maria@example.com',
            passportNumber: 'P1234567',
            education: 'Bachelor of Science in Nursing',
          },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applicant: {
          id: 'applicant-1',
          firstName: 'Maria',
          middleName: 'Santos',
          lastName: 'Reyes',
          dateOfBirth: '1997-05-20',
          sex: 'Female',
          phoneNumber: '+639171234567',
          emailAddress: 'maria@example.com',
          passportNumber: 'P1234567',
          education: 'Bachelor of Science in Nursing',
          currentLocation: 'Singapore',
          profession: 'ICU Nurse',
        },
      }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));
  await user.type(await screen.findByLabelText(/search applicant/i), 'Maria');

  await screen.findByText(line('Passport: P1234567'));
  await user.click(screen.getByRole('button', { name: /edit maria santos reyes/i }));

  expect(screen.getByRole('heading', { name: /edit applicant/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/first name/i)).toHaveValue('Maria');
  expect(screen.getByLabelText(/passport number/i)).toHaveValue('P1234567');

  await user.type(screen.getByLabelText(/current location/i), 'Singapore');
  await user.type(screen.getByLabelText(/profession/i), 'ICU Nurse');
  await user.click(screen.getByRole('button', { name: /update applicant/i }));

  await waitFor(() => {
    expect(screen.getByText('Applicant updated in MongoDB.')).toBeInTheDocument();
  });
  expect(screen.getByText(line('Current location: Singapore'))).toBeInTheDocument();
  expect(screen.getByText(line('Profession: ICU Nurse'))).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith(
    'http://localhost:5001/api/applicants/applicant-1',
    expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({
        Authorization: 'Bearer abc123',
        'Content-Type': 'application/json',
      }),
    }),
  );
});

test('blocks saving when the email or phone number is invalid', async () => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'abc123',
        user: { id: '1', username: 'wendell' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applicants: [] }),
    });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await screen.findByRole('heading', { name: /applicant dashboard/i });

  await user.type(screen.getByLabelText(/first name/i), 'Maria');
  await user.type(screen.getByLabelText(/last name/i), 'Reyes');
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1997-05-20' } });
  await user.selectOptions(screen.getByLabelText(/sex/i), 'Female');
  await user.type(screen.getByLabelText(/passport number/i), 'P1234567');
  await user.type(screen.getByLabelText(/^education$/i), 'Bachelor of Science in Nursing');

  await user.type(screen.getByLabelText(/email address/i), 'maria(at)example');
  expect(screen.getByText('Enter a valid email like name@example.com.')).toBeInTheDocument();
  await user.clear(screen.getByLabelText(/email address/i));
  await user.type(screen.getByLabelText(/email address/i), 'maria@example.com');

  await user.type(screen.getByLabelText(/phone number/i), '12ab');
  expect(screen.getByText('Enter 6 to 15 digits (numbers only).')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /save applicant/i }));

  expect(screen.getByText('Please enter a valid phone number (6 to 15 digits)')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('switches to register and creates an account', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ message: 'User registered successfully' }),
  });

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: /create one/i }));
  await user.type(screen.getByLabelText(/username/i), 'newuser');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(screen.getByText('Account created. You can log in now.')).toBeInTheDocument();
  });
});
