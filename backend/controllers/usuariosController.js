const db = require('../config/database');
const bcrypt = require('bcryptjs');

// GET all users (admin only)
exports.getAll = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, usuario, nombre_completo, rol, activo, created_at FROM usuarios ORDER BY nombre_completo'
    );
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
  }
};

// GET single user
exports.getById = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, usuario, nombre_completo, rol, activo, created_at FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, data: users[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener usuario' });
  }
};

// CREATE user (admin only)
exports.create = async (req, res) => {
  const { usuario, password, nombre_completo, rol } = req.body;

  if (!usuario || !password || !nombre_completo) {
    return res.status(400).json({ success: false, message: 'Usuario, contraseña y nombre completo son requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (!['admin', 'lectura'].includes(rol)) {
    return res.status(400).json({ success: false, message: 'El rol debe ser "admin" o "lectura"' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM usuarios WHERE usuario = ?', [usuario.trim().toUpperCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese nombre' });
    }

    const hashedPass = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (usuario, password, nombre_completo, rol) VALUES (?, ?, ?, ?)',
      [usuario.trim().toUpperCase(), hashedPass, nombre_completo.trim(), rol]
    );

    const [newUser] = await db.query(
      'SELECT id, usuario, nombre_completo, rol, activo, created_at FROM usuarios WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ success: true, message: 'Usuario creado exitosamente', data: newUser[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese nombre' });
    }
    res.status(500).json({ success: false, message: 'Error al crear usuario' });
  }
};

// UPDATE user (admin only)
exports.update = async (req, res) => {
  const { nombre_completo, rol, activo } = req.body;
  const { id } = req.params;

  try {
    const [existing] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (rol && !['admin', 'lectura'].includes(rol)) {
      return res.status(400).json({ success: false, message: 'Rol inválido' });
    }

    await db.query(
      'UPDATE usuarios SET nombre_completo = COALESCE(?, nombre_completo), rol = COALESCE(?, rol), activo = COALESCE(?, activo) WHERE id = ?',
      [nombre_completo, rol, activo, id]
    );

    const [updated] = await db.query(
      'SELECT id, usuario, nombre_completo, rol, activo, created_at FROM usuarios WHERE id = ?', [id]
    );
    res.json({ success: true, message: 'Usuario actualizado', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
};

// CHANGE PASSWORD (any user for themselves)
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Contraseña actual y nueva contraseña son requeridas' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const [users] = await db.query('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(current_password, users[0].password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al cambiar contraseña' });
  }
};

// DELETE user (admin only)
exports.delete = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (existing[0].id === 1) {
      return res.status(400).json({ success: false, message: 'No se puede eliminar el usuario administrador principal' });
    }

    if (req.user.id === parseInt(req.params.id)) {
      return res.status(400).json({ success: false, message: 'No puede eliminar su propia cuenta' });
    }

    await db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
  }
};
