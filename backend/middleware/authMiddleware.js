const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[AUTH] ❌ JWT_SECRET no está definida en las variables de entorno (.env)');
  process.exit(1);
}
const JWT_ALGORITHM = 'HS256';

// Verify JWT token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado. Inicie sesión para continuar.'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token || token.split('.').length !== 3) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      maxAge: '24h'
    });

    // Sanitize user data - never trust client-sent data
    req.user = {
      id: decoded.id,
      usuario: decoded.usuario,
      nombre_completo: decoded.nombre_completo,
      rol: decoded.rol
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Sesión expirada. Inicie sesión nuevamente.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token inválido. Inicie sesión nuevamente.'
    });
  }
};

// Require admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren permisos de administrador.'
    });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
