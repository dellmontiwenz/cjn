import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.get('Authorization');

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing authorization token' });
  }

  try {
    req.user = jwt.verify(header.slice('Bearer '.length), process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid authorization token' });
  }
}
