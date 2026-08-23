const db = require('../config/database');

// GET all assignments with filters
exports.getAll = async (req, res) => {
  try {
    let query = `
      SELECT ap.*, a.nombre AS area_nombre, p.nombre AS producto_nombre, p.codigo AS producto_codigo
      FROM area_producto ap
      JOIN areas a ON ap.area_id = a.id
      JOIN productos p ON ap.producto_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.area_id) {
      query += ' AND ap.area_id = ?';
      params.push(req.query.area_id);
    }
    if (req.query.producto_id) {
      query += ' AND ap.producto_id = ?';
      params.push(req.query.producto_id);
    }

    query += ' ORDER BY a.nombre, p.nombre';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener asignaciones' });
  }
};

// GET assignments by area
exports.getByArea = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ap.*, a.nombre AS area_nombre, p.nombre AS producto_nombre, p.codigo AS producto_codigo
       FROM area_producto ap
       JOIN areas a ON ap.area_id = a.id
       JOIN productos p ON ap.producto_id = p.id
       WHERE ap.area_id = ?
       ORDER BY p.nombre`,
      [req.params.areaId]
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener asignaciones del área' });
  }
};

// CREATE a new assignment
exports.create = async (req, res) => {
  const { area_id, producto_id, cantidad_asignada } = req.body;

  if (!area_id || !producto_id || cantidad_asignada === undefined) {
    return res.status(400).json({ success: false, message: 'Área, producto y cantidad asignada son requeridos' });
  }

  if (cantidad_asignada < 0) {
    return res.status(400).json({ success: false, message: 'La cantidad asignada no puede ser negativa' });
  }

  try {
    // Verify area and product exist
    const [area] = await db.query('SELECT id FROM areas WHERE id = ?', [area_id]);
    if (area.length === 0) {
      return res.status(404).json({ success: false, message: 'Área no encontrada' });
    }
    const [product] = await db.query('SELECT id FROM productos WHERE id = ?', [producto_id]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    // Check for duplicate assignment
    const [existing] = await db.query(
      'SELECT id FROM area_producto WHERE area_id = ? AND producto_id = ?',
      [area_id, producto_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Este producto ya está asignado a esta área' });
    }

    const [result] = await db.query(
      'INSERT INTO area_producto (area_id, producto_id, cantidad_asignada) VALUES (?, ?, ?)',
      [area_id, producto_id, cantidad_asignada]
    );

    const [newAssignment] = await db.query(
      `SELECT ap.*, a.nombre AS area_nombre, p.nombre AS producto_nombre, p.codigo AS producto_codigo
       FROM area_producto ap
       JOIN areas a ON ap.area_id = a.id
       JOIN productos p ON ap.producto_id = p.id
       WHERE ap.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: 'Asignación creada exitosamente', data: newAssignment[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Este producto ya está asignado a esta área' });
    }
    res.status(500).json({ success: false, message: 'Error al crear asignación' });
  }
};

// UPDATE an assignment
exports.update = async (req, res) => {
  const { cantidad_asignada } = req.body;
  const { id } = req.params;

  if (cantidad_asignada === undefined || cantidad_asignada < 0) {
    return res.status(400).json({ success: false, message: 'La cantidad asignada es requerida y no puede ser negativa' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM area_producto WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Asignación no encontrada' });
    }

    await db.query('UPDATE area_producto SET cantidad_asignada = ? WHERE id = ?', [cantidad_asignada, id]);

    const [updated] = await db.query(
      `SELECT ap.*, a.nombre AS area_nombre, p.nombre AS producto_nombre, p.codigo AS producto_codigo
       FROM area_producto ap
       JOIN areas a ON ap.area_id = a.id
       JOIN productos p ON ap.producto_id = p.id
       WHERE ap.id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Asignación actualizada exitosamente', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar asignación' });
  }
};

// DELETE an assignment
exports.delete = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM area_producto WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Asignación no encontrada' });
    }

    await db.query('DELETE FROM area_producto WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Asignación eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar asignación' });
  }
};
