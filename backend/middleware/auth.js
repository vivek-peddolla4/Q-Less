const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Auth Error: No token provided' });

  try {
    const bearerToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(bearerToken, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    console.error('[AUTH] Token verification failed:', e.message);
    res.status(401).json({ message: 'Invalid Token' });
  }
};
