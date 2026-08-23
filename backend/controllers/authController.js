const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[AUTH] ❌ JWT_SECRET no está definida en las variables de entorno (.env)');
  process.exit(1);
}
const JWT_EXPIRES = '8h'; // Reduced from 24h
const JWT_ALGORITHM = 'HS256';

// POST /api/auth/login
exports.login = async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({
      success: false,
      message: 'Usuario y contraseña son requeridos'
    });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM usuarios WHERE usuario = ? AND activo = TRUE',
      [usuario.trim().toUpperCase()]
    );

    if (users.length === 0) {
      // Same error for wrong user or wrong password (don't reveal which)
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas.'
      });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas.'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        usuario: user.usuario,
        nombre_completo: user.nombre_completo,
        rol: user.rol
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES, algorithm: JWT_ALGORITHM }
    );

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        token,
        user: {
          id: user.id,
          usuario: user.usuario,
          nombre_completo: user.nombre_completo,
          rol: user.rol
        }
      }
    });
  } catch (error) {
    console.error('[AUTH] Error en login:', error.message);
    res.status(500).json({ success: false, message: 'Error al procesar el inicio de sesión.' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, usuario, nombre_completo, rol, activo, created_at FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error('[AUTH] Error en me:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener usuario.' });
  }
};

// GET /api/auth/users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, usuario, nombre_completo, rol, activo, created_at FROM usuarios ORDER BY nombre_completo'
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('[AUTH] Error en getAllUsers:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener usuarios.' });
  }
};
