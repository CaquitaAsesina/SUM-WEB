const db = require('../config/database');

// GET all movement records with filters
exports.getAll = async (req, res) => {
  try {
    let query = `
      SELECT m.*, p.nombre AS periodo_nombre, a.nombre AS area_nombre,
             pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
      FROM movimientos_fuera_picking m
      JOIN periodos p ON m.periodo_id = p.id
      JOIN areas a ON m.area_id = a.id
      JOIN productos pr ON m.producto_id = pr.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.periodo_id) {
      query += ' AND m.periodo_id = ?';
      params.push(req.query.periodo_id);
    }
    if (req.query.area_id) {
      query += ' AND m.area_id = ?';
      params.push(req.query.area_id);
    }
    if (req.query.producto_id) {
      query += ' AND m.producto_id = ?';
      params.push(req.query.producto_id);
    }
    if (req.query.fecha_desde) {
      query += ' AND DATE(m.created_at) >= ?';
      params.push(req.query.fecha_desde);
    }
    if (req.query.fecha_hasta) {
      query += ' AND DATE(m.created_at) <= ?';
      params.push(req.query.fecha_hasta);
    }

    query += ' ORDER BY m.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener movimientos' });
  }
};

// CREATE a new movement
exports.create = async (req, res) => {
  const { area_id, producto_id, cantidad, motivo } = req.body;
  const periodo_id = req.activePeriodoId;

  if (!area_id || !producto_id || !cantidad) {
    return res.status(400).json({ success: false, message: 'Área, producto y cantidad son requeridos' });
  }

  if (cantidad <= 0) {
    return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' });
  }

  try {
    // Verify area and product exist and are assigned
    const [assignment] = await db.query(
      'SELECT id FROM area_producto WHERE area_id = ? AND producto_id = ?',
      [area_id, producto_id]
    );
    if (assignment.length === 0) {
      return res.status(400).json({ success: false, message: 'Este producto no está asignado a esta área' });
    }

    const [result] = await db.query(
      'INSERT INTO movimientos_fuera_picking (periodo_id, area_id, producto_id, cantidad, motivo) VALUES (?, ?, ?, ?, ?)',
      [periodo_id, area_id, producto_id, cantidad, motivo || null]
    );

    const [newMovement] = await db.query(
      `SELECT m.*, a.nombre AS area_nombre, pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM movimientos_fuera_picking m
       JOIN areas a ON m.area_id = a.id
       JOIN productos pr ON m.producto_id = pr.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: 'Movimiento registrado exitosamente', data: newMovement[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al registrar movimiento' });
  }
};

// UPDATE a movement
exports.update = async (req, res) => {
  const { cantidad, motivo } = req.body;
  const { id } = req.params;

  if (cantidad === undefined || cantidad <= 0) {
    return res.status(400).json({ success: false, message: 'La cantidad es requerida y debe ser mayor a 0' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM movimientos_fuera_picking WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Movimiento no encontrado' });
    }

    // Check period is still active
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [existing[0].periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período de este movimiento ya está cerrado' });
    }

    await db.query('UPDATE movimientos_fuera_picking SET cantidad = ?, motivo = ? WHERE id = ?', [cantidad, motivo || null, id]);

    const [updated] = await db.query(
      `SELECT m.*, a.nombre AS area_nombre, pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM movimientos_fuera_picking m
       JOIN areas a ON m.area_id = a.id
       JOIN productos pr ON m.producto_id = pr.id
       WHERE m.id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Movimiento actualizado exitosamente', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar movimiento' });
  }
};

// DELETE a movement
exports.delete = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM movimientos_fuera_picking WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Movimiento no encontrado' });
    }

    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [existing[0].periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período de este movimiento ya está cerrado' });
    }

    await db.query('DELETE FROM movimientos_fuera_picking WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Movimiento eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar movimiento' });
  }
};
