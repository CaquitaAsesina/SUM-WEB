const db = require('../config/database');

// GET all products with optional filters
exports.getAll = async (req, res) => {
  try {
    let query = 'SELECT * FROM productos WHERE 1=1';
    const params = [];

    if (req.query.nombre) {
      query += ' AND nombre LIKE ?';
      params.push(`%${req.query.nombre}%`);
    }
    if (req.query.codigo) {
      query += ' AND codigo LIKE ?';
      params.push(`%${req.query.codigo}%`);
    }

    query += ' ORDER BY nombre ASC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
};

// GET single product by ID
exports.getById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener producto' });
  }
};

// CREATE a new product
exports.create = async (req, res) => {
  const { nombre, codigo } = req.body;

  if (!nombre || !codigo) {
    return res.status(400).json({ success: false, message: 'Nombre y código son requeridos' });
  }

  try {
    // Check for duplicates
    const [existing] = await db.query('SELECT id FROM productos WHERE codigo = ? OR nombre = ?', [codigo, nombre]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe un producto con ese nombre o código' });
    }

    const [result] = await db.query('INSERT INTO productos (nombre, codigo) VALUES (?, ?)', [nombre.trim(), codigo.trim()]);
    const [newProduct] = await db.query('SELECT * FROM productos WHERE id = ?', [result.insertId]);

    res.status(201).json({ success: true, message: 'Producto creado exitosamente', data: newProduct[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ya existe un producto con ese nombre o código' });
    }
    res.status(500).json({ success: false, message: 'Error al crear producto' });
  }
};

// UPDATE a product
exports.update = async (req, res) => {
  const { nombre, codigo } = req.body;
  const { id } = req.params;

  if (!nombre || !codigo) {
    return res.status(400).json({ success: false, message: 'Nombre y código son requeridos' });
  }

  try {
    // Check product exists
    const [existing] = await db.query('SELECT id FROM productos WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    // Check for duplicates excluding current product
    const [duplicate] = await db.query(
      'SELECT id FROM productos WHERE (codigo = ? OR nombre = ?) AND id != ?',
      [codigo, nombre, id]
    );
    if (duplicate.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe otro producto con ese nombre o código' });
    }

    await db.query('UPDATE productos SET nombre = ?, codigo = ? WHERE id = ?', [nombre.trim(), codigo.trim(), id]);
    const [updated] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);

    res.json({ success: true, message: 'Producto actualizado exitosamente', data: updated[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ya existe otro producto con ese nombre o código' });
    }
    res.status(500).json({ success: false, message: 'Error al actualizar producto' });
  }
};

// DELETE a product
exports.delete = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM productos WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    await db.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
};
