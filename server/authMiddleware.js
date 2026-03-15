const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-token-for-frontlearn';

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '未提供身份凭证' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || typeof payload.userId !== 'number') {
      return res.status(401).json({ error: '身份凭证无效，请重新登录' });
    }
    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role || 'student',
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: '身份凭证无效或已过期' });
  }
}

module.exports = {
  authRequired,
  adminRequired(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  },
  JWT_SECRET,
};

