const db = require('../config/database');

// GET all areas with optional filters
exports.getAll = async (req, res) => {
  try {
    let query = 'SELECT * FROM areas WHERE 1=1';
    const params = [];

    if (req.query.nombre) {
      query += ' AND nombre LIKE ?';
      params.push(`%${req.query.nombre}%`);
    }

    query += ' ORDER BY nombre ASC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener áreas' });
  }
};

// GET single area by ID
exports.getById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM areas WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Área no encontrada' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener área' });
  }
};

// CREATE a new area
exports.create = async (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre es requerido' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM areas WHERE nombre = ?', [nombre.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe un área con ese nombre' });
    }

    const [result] = await db.query('INSERT INTO areas (nombre, descripcion) VALUES (?, ?)', [nombre.trim(), descripcion || null]);
    const [newArea] = await db.query('SELECT * FROM areas WHERE id = ?', [result.insertId]);

    res.status(201).json({ success: true, message: 'Área creada exitosamente', data: newArea[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ya existe un área con ese nombre' });
    }
    res.status(500).json({ success: false, message: 'Error al crear área' });
  }
};

// UPDATE an area
exports.update = async (req, res) => {
  const { nombre, descripcion } = req.body;
  const { id } = req.params;

  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre es requerido' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM areas WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Área no encontrada' });
    }

    const [duplicate] = await db.query('SELECT id FROM areas WHERE nombre = ? AND id != ?', [nombre.trim(), id]);
    if (duplicate.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe otra área con ese nombre' });
    }

    await db.query('UPDATE areas SET nombre = ?, descripcion = ? WHERE id = ?', [nombre.trim(), descripcion || null, id]);
    const [updated] = await db.query('SELECT * FROM areas WHERE id = ?', [id]);

    res.json({ success: true, message: 'Área actualizada exitosamente', data: updated[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ya existe otra área con ese nombre' });
    }
    res.status(500).json({ success: false, message: 'Error al actualizar área' });
  }
};

// DELETE an area
exports.delete = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM areas WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Área no encontrada' });
    }

    await db.query('DELETE FROM areas WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Área eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar área' });
  }
};
