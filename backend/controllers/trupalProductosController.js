const db = require('../config/database');

// GET all
exports.getAll = async (req, res) => {
  try {
    const { nombre, codigo, buscar } = req.query;
    let query = 'SELECT * FROM trupal_productos WHERE 1=1';
    const params = [];
    if (nombre) { query += ' AND nombre LIKE ?'; params.push(`%${nombre}%`); }
    if (codigo) { query += ' AND codigo LIKE ?'; params.push(`%${codigo}%`); }
    if (buscar) { query += ' AND (nombre LIKE ? OR codigo LIKE ?)'; params.push(`%${buscar}%`, `%${buscar}%`); }
    query += ' ORDER BY nombre ASC';
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al obtener productos Trupal:', error);
    res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
};

// GET one
exports.getById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM trupal_productos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener producto' });
  }
};

// CREATE
exports.create = async (req, res) => {
  try {
    const { nombre, codigo } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'El nombre es obligatorio (mínimo 2 caracteres).' });
    }
    // Check duplicate name
    const [existing] = await db.query('SELECT id FROM trupal_productos WHERE nombre = ?', [nombre.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Ya existe un producto con ese nombre.' });
    }
    if (codigo) {
      const [existingCode] = await db.query('SELECT id FROM trupal_productos WHERE codigo = ?', [codigo.trim()]);
      if (existingCode.length > 0) {
        return res.status(400).json({ success: false, message: 'Ya existe un producto con ese código.' });
      }
    }
    const [result] = await db.query(
      'INSERT INTO trupal_productos (nombre, codigo) VALUES (?, ?)',
      [nombre.trim(), codigo ? codigo.trim() : null]
    );
    const [newRecord] = await db.query('SELECT * FROM trupal_productos WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Producto creado exitosamente', data: newRecord[0] });
  } catch (error) {
    console.error('Error al crear producto Trupal:', error);
    res.status(500).json({ success: false, message: 'Error al crear producto' });
  }
};

// UPDATE
exports.update = async (req, res) => {
  try {
    const { nombre, codigo } = req.body;
    const { id } = req.params;
    const [existing] = await db.query('SELECT * FROM trupal_productos WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

    if (!nombre || nombre.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'El nombre debe tener al menos 2 caracteres.' });
    }
    // Check duplicate name (excluding self)
    const [dupName] = await db.query('SELECT id FROM trupal_productos WHERE nombre = ? AND id != ?', [nombre.trim(), id]);
    if (dupName.length > 0) {
      return res.status(400).json({ success: false, message: 'Ya existe otro producto con ese nombre.' });
    }
    if (codigo) {
      const [dupCode] = await db.query('SELECT id FROM trupal_productos WHERE codigo = ? AND id != ?', [codigo.trim(), id]);
      if (dupCode.length > 0) {
        return res.status(400).json({ success: false, message: 'Ya existe otro producto con ese código.' });
      }
    }
    await db.query('UPDATE trupal_productos SET nombre = ?, codigo = ? WHERE id = ?',
      [nombre.trim(), codigo ? codigo.trim() : null, id]);
    const [updated] = await db.query('SELECT * FROM trupal_productos WHERE id = ?', [id]);
    res.json({ success: true, message: 'Producto actualizado exitosamente', data: updated[0] });
  } catch (error) {
    console.error('Error al actualizar producto Trupal:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar producto' });
  }
};

// DELETE
exports.remove = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM trupal_productos WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    // Check if used in movements
    const [inUse] = await db.query('SELECT COUNT(*) as cnt FROM trupal WHERE producto_id = ?', [req.params.id]);
    if (inUse[0].cnt > 0) {
      return res.status(400).json({ success: false, message: `No se puede eliminar: tiene ${inUse[0].cnt} registro(s) de movimiento(s) asociado(s). Elimine primero los movimientos.` });
    }
    await db.query('DELETE FROM trupal_productos WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto Trupal:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
};
