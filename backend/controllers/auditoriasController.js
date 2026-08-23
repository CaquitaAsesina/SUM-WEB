const db = require('../config/database');

// GET all audit records with filters
exports.getAll = async (req, res) => {
  try {
    let query = `
      SELECT au.*, p.nombre AS periodo_nombre, a.nombre AS area_nombre,
             pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
      FROM auditorias au
      JOIN periodos p ON au.periodo_id = p.id
      JOIN areas a ON au.area_id = a.id
      JOIN productos pr ON au.producto_id = pr.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.periodo_id) {
      query += ' AND au.periodo_id = ?';
      params.push(req.query.periodo_id);
    }
    if (req.query.area_id) {
      query += ' AND au.area_id = ?';
      params.push(req.query.area_id);
    }
    if (req.query.producto_id) {
      query += ' AND au.producto_id = ?';
      params.push(req.query.producto_id);
    }

    query += ' ORDER BY au.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener auditorías' });
  }
};

// GET audit form data - products assigned to an area
exports.getAuditForm = async (req, res) => {
  const { area_id } = req.query;
  if (!area_id) {
    return res.status(400).json({ success: false, message: 'Se requiere area_id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT ap.*, pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM area_producto ap
       JOIN productos pr ON ap.producto_id = pr.id
       WHERE ap.area_id = ?
       ORDER BY pr.nombre`,
      [area_id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener datos de auditoría' });
  }
};

// CREATE audit records (batch - one or multiple products at once)
exports.create = async (req, res) => {
  const { periodo_id, area_id, registros } = req.body;

  if (!periodo_id || !area_id || !registros || !Array.isArray(registros)) {
    return res.status(400).json({ success: false, message: 'Período, área y registros son requeridos' });
  }

  try {
    // Verify period is active
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período no está activo o no existe' });
    }

    // Verify area exists
    const [area] = await db.query('SELECT * FROM areas WHERE id = ?', [area_id]);
    if (area.length === 0) {
      return res.status(404).json({ success: false, message: 'Área no encontrada' });
    }

    // Verify: only ONE audit per area per period
    const [existingAudit] = await db.query(
      'SELECT id FROM auditorias WHERE periodo_id = ? AND area_id = ? LIMIT 1',
      [periodo_id, area_id]
    );
    if (existingAudit.length > 0) {
      const [areaRow] = await db.query('SELECT nombre FROM areas WHERE id = ?', [area_id]);
      const nombre = areaRow[0]?.nombre || 'esta área';
      return res.status(400).json({ success: false, message: `Ya se registró una auditoría para "${nombre}" en este período. No se puede duplicar.` });
    }

    const results = [];
    for (const registro of registros) {
      const { producto_id, cantidad_encontrada } = registro;

      if (!producto_id || cantidad_encontrada === undefined) {
        continue;
      }

      // Verify product is assigned to this area
      const [assignment] = await db.query(
        'SELECT id FROM area_producto WHERE area_id = ? AND producto_id = ?',
        [area_id, producto_id]
      );

      if (assignment.length === 0) {
        continue; // Skip products not assigned to this area
      }

      const [result] = await db.query(
        'INSERT INTO auditorias (periodo_id, area_id, producto_id, cantidad_encontrada) VALUES (?, ?, ?, ?)',
        [periodo_id, area_id, producto_id, cantidad_encontrada]
      );

      results.push({ id: result.insertId, producto_id, cantidad_encontrada });
    }

    res.status(201).json({
      success: true,
      message: `Auditoría registrada: ${results.length} producto(s) auditado(s)`,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al registrar auditoría' });
  }
};

// CREATE single audit record
exports.createSingle = async (req, res) => {
  const { periodo_id, area_id, producto_id, cantidad_encontrada } = req.body;

  if (!periodo_id || !area_id || !producto_id || cantidad_encontrada === undefined) {
    return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
  }

  try {
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período no está activo o no existe' });
    }

    const [assignment] = await db.query(
      'SELECT id FROM area_producto WHERE area_id = ? AND producto_id = ?',
      [area_id, producto_id]
    );
    if (assignment.length === 0) {
      return res.status(400).json({ success: false, message: 'Este producto no está asignado a esta área' });
    }

    const [result] = await db.query(
      'INSERT INTO auditorias (periodo_id, area_id, producto_id, cantidad_encontrada) VALUES (?, ?, ?, ?)',
      [periodo_id, area_id, producto_id, cantidad_encontrada]
    );

    const [newAudit] = await db.query(
      `SELECT au.*, a.nombre AS area_nombre, pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM auditorias au
       JOIN areas a ON au.area_id = a.id
       JOIN productos pr ON au.producto_id = pr.id
       WHERE au.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: 'Auditoría registrada exitosamente', data: newAudit[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al registrar auditoría' });
  }
};

// UPDATE an audit record
exports.update = async (req, res) => {
  const { cantidad_encontrada } = req.body;
  const { id } = req.params;

  if (cantidad_encontrada === undefined) {
    return res.status(400).json({ success: false, message: 'La cantidad encontrada es requerida' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM auditorias WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Auditoría no encontrada' });
    }

    // Check period is still active
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [existing[0].periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período de esta auditoría ya está cerrado' });
    }

    await db.query('UPDATE auditorias SET cantidad_encontrada = ? WHERE id = ?', [cantidad_encontrada, id]);

    const [updated] = await db.query(
      `SELECT au.*, a.nombre AS area_nombre, pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM auditorias au
       JOIN areas a ON au.area_id = a.id
       JOIN productos pr ON au.producto_id = pr.id
       WHERE au.id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Auditoría actualizada exitosamente', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar auditoría' });
  }
};

// DELETE an audit record
exports.delete = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM auditorias WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Auditoría no encontrada' });
    }

    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [existing[0].periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período de esta auditoría ya está cerrado' });
    }

    await db.query('DELETE FROM auditorias WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Auditoría eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar auditoría' });
  }
};
