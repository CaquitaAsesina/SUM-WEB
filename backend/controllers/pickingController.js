const db = require('../config/database');

// GET all picking records with filters
exports.getAll = async (req, res) => {
  try {
    let query = `
      SELECT pk.*, p.nombre AS periodo_nombre, a.nombre AS area_nombre,
             pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
      FROM picking pk
      JOIN periodos p ON pk.periodo_id = p.id
      JOIN areas a ON pk.area_id = a.id
      JOIN productos pr ON pk.producto_id = pr.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.periodo_id) {
      query += ' AND pk.periodo_id = ?';
      params.push(req.query.periodo_id);
    }
    if (req.query.area_id) {
      query += ' AND pk.area_id = ?';
      params.push(req.query.area_id);
    }
    if (req.query.producto_id) {
      query += ' AND pk.producto_id = ?';
      params.push(req.query.producto_id);
    }

    query += ' ORDER BY pk.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener registros de picking' });
  }
};

// Calculate the quantity to deliver based on the formula
const calculatePickingQuantity = async (periodo_id, area_id, producto_id) => {
  // Get the assigned quantity
  const [assignments] = await db.query(
    'SELECT cantidad_asignada FROM area_producto WHERE area_id = ? AND producto_id = ?',
    [area_id, producto_id]
  );

  if (assignments.length === 0) {
    return { error: 'Este producto no está asignado a esta área' };
  }

  const cantidadAsignada = assignments[0].cantidad_asignada;

  // Get the last audit found quantity for this area-product in ANY previous period
  const [audits] = await db.query(
    `SELECT cantidad_encontrada FROM auditorias
     WHERE area_id = ? AND producto_id = ? AND periodo_id < ?
     ORDER BY created_at DESC LIMIT 1`,
    [area_id, producto_id, periodo_id]
  );

  // Also check current period audits before any picking in this period
  const [currentAudits] = await db.query(
    `SELECT cantidad_encontrada FROM auditorias
     WHERE area_id = ? AND producto_id = ? AND periodo_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [area_id, producto_id, periodo_id]
  );

  let cantidadEncontrada = 0;

  if (currentAudits.length > 0) {
    cantidadEncontrada = currentAudits[0].cantidad_encontrada;
  } else if (audits.length > 0) {
    cantidadEncontrada = audits[0].cantidad_encontrada;
  } else {
    // No previous audit found, deliver the full standard quantity
    return {
      cantidad_calculada: cantidadAsignada,
      cantidad_encontrada: 0,
      es_excedente: false
    };
  }

  let cantidadCalculada;

  if (cantidadEncontrada >= cantidadAsignada) {
    // Stock is sufficient/excess, deliver 0
    cantidadCalculada = 0;
  } else {
    // Complete up to standard
    cantidadCalculada = cantidadAsignada - cantidadEncontrada;
  }

  return {
    cantidad_calculada: cantidadCalculada,
    cantidad_encontrada: cantidadEncontrada,
    cantidad_asignada: cantidadAsignada,
    es_excedente: cantidadEncontrada > 0 && cantidadCalculada < cantidadAsignada
  };
};

// GET calculate picking for a specific area-product
exports.calculate = async (req, res) => {
  const { periodo_id, area_id, producto_id } = req.query;

  if (!periodo_id || !area_id || !producto_id) {
    return res.status(400).json({ success: false, message: 'Se requieren periodo_id, area_id y producto_id' });
  }

  try {
    const calculation = await calculatePickingQuantity(periodo_id, area_id, producto_id);
    if (calculation.error) {
      return res.status(404).json({ success: false, message: calculation.error });
    }
    res.json({ success: true, data: calculation });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al calcular picking' });
  }
};

// GET all auto-calculated pickings for an area in a period
exports.calculateForArea = async (req, res) => {
  const { periodo_id, area_id } = req.query;

  if (!periodo_id || !area_id) {
    return res.status(400).json({ success: false, message: 'Se requieren periodo_id y area_id' });
  }

  try {
    // Get all assignments for this area
    const [assignments] = await db.query(
      `SELECT ap.*, pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM area_producto ap
       JOIN productos pr ON ap.producto_id = pr.id
       WHERE ap.area_id = ?
       ORDER BY pr.nombre`,
      [area_id]
    );

    const calculations = [];
    for (const asig of assignments) {
      const calc = await calculatePickingQuantity(periodo_id, area_id, asig.producto_id);
      calculations.push({
        area_id,
        area_nombre: (await db.query('SELECT nombre FROM areas WHERE id = ?', [area_id]))[0][0]?.nombre,
        producto_id: asig.producto_id,
        producto_nombre: asig.producto_nombre,
        producto_codigo: asig.producto_codigo,
        cantidad_asignada: asig.cantidad_asignada,
        ...calc
      });
    }

    res.json({ success: true, data: calculations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al calcular pickings del área' });
  }
};

// CREATE a picking record
exports.create = async (req, res) => {
  const { periodo_id, area_id, producto_id, cantidad_entregada } = req.body;

  if (!periodo_id || !area_id || !producto_id || cantidad_entregada === undefined) {
    return res.status(400).json({ success: false, message: 'Período, área, producto y cantidad entregada son requeridos' });
  }

  try {
    // Verify period is active
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período no está activo o no existe' });
    }

    // Verify: only ONE picking batch per area per period
    const [existingPicking] = await db.query(
      'SELECT id FROM picking WHERE periodo_id = ? AND area_id = ? LIMIT 1',
      [periodo_id, area_id]
    );
    if (existingPicking.length > 0) {
      const [areaName] = await db.query('SELECT nombre FROM areas WHERE id = ?', [area_id]);
      const nombre = areaName[0]?.nombre || 'esta área';
      return res.status(400).json({ success: false, message: `Ya se registró un picking para "${nombre}" en este período. No se puede duplicar.` });
    }

    // Calculate the automatic quantity
    const calculation = await calculatePickingQuantity(periodo_id, area_id, producto_id);
    if (calculation.error) {
      return res.status(404).json({ success: false, message: calculation.error });
    }

    // Check for oversock alert
    let alerta = null;
    if (calculation.cantidad_encontrada > 0 && cantidad_entregada > calculation.cantidad_calculada) {
      const exceso = cantidad_entregada - calculation.cantidad_calculada;
      alerta = `Esta entrega generará sobrestock de ${exceso} unidades sobre el estándar. Debe registrarse como Movimiento Fuera del Picking.`;
    }

    const [result] = await db.query(
      'INSERT INTO picking (periodo_id, area_id, producto_id, cantidad_entregada, cantidad_calculada) VALUES (?, ?, ?, ?, ?)',
      [periodo_id, area_id, producto_id, cantidad_entregada, calculation.cantidad_calculada]
    );

    const [newPicking] = await db.query(
      `SELECT pk.*, p.nombre AS periodo_nombre, a.nombre AS area_nombre,
              pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM picking pk
       JOIN periodos p ON pk.periodo_id = p.id
       JOIN areas a ON pk.area_id = a.id
       JOIN productos pr ON pk.producto_id = pr.id
       WHERE pk.id = ?`,
      [result.insertId]
    );

    const response = { success: true, message: 'Picking registrado exitosamente', data: newPicking[0] };
    if (alerta) {
      response.alerta = alerta;
    }

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al registrar picking' });
  }
};

// UPDATE a picking record
exports.update = async (req, res) => {
  const { cantidad_entregada } = req.body;
  const { id } = req.params;

  if (cantidad_entregada === undefined) {
    return res.status(400).json({ success: false, message: 'La cantidad entregada es requerida' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM picking WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro de picking no encontrado' });
    }

    const picking = existing[0];

    // Verify period is still active
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [picking.periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período de este picking ya está cerrado' });
    }

    // Recalculate
    const calculation = await calculatePickingQuantity(picking.periodo_id, picking.area_id, picking.producto_id);

    let alerta = null;
    if (calculation.cantidad_encontrada > 0 && cantidad_entregada > calculation.cantidad_calculada) {
      const exceso = cantidad_entregada - calculation.cantidad_calculada;
      alerta = `Esta entrega generará sobrestock de ${exceso} unidades sobre el estándar. Debe registrarse como Movimiento Fuera del Picking.`;
    }

    await db.query(
      'UPDATE picking SET cantidad_entregada = ?, cantidad_calculada = ? WHERE id = ?',
      [cantidad_entregada, calculation.cantidad_calculada, id]
    );

    const [updated] = await db.query(
      `SELECT pk.*, p.nombre AS periodo_nombre, a.nombre AS area_nombre,
              pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
       FROM picking pk
       JOIN periodos p ON pk.periodo_id = p.id
       JOIN areas a ON pk.area_id = a.id
       JOIN productos pr ON pk.producto_id = pr.id
       WHERE pk.id = ?`,
      [id]
    );

    const response = { success: true, message: 'Picking actualizado exitosamente', data: updated[0] };
    if (alerta) {
      response.alerta = alerta;
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar picking' });
  }
};

// DELETE a picking record
exports.delete = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM picking WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro de picking no encontrado' });
    }

    // Check if period is still active
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [existing[0].periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período de este picking ya está cerrado' });
    }

    await db.query('DELETE FROM picking WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Picking eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar picking' });
  }
};

// CREATE a batch of pickings for one area in one period
exports.createBatch = async (req, res) => {
  const { periodo_id, area_id, registros } = req.body;

  if (!periodo_id || !area_id || !Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ success: false, message: 'Período, área y registros son requeridos' });
  }

  try {
    // Verify period is active
    const [period] = await db.query("SELECT * FROM periodos WHERE id = ? AND estado = 'activo'", [periodo_id]);
    if (period.length === 0) {
      return res.status(400).json({ success: false, message: 'El período no está activo o no existe' });
    }

    // Verify: only ONE picking batch per area per period
    const [existingPicking] = await db.query(
      'SELECT id FROM picking WHERE periodo_id = ? AND area_id = ? LIMIT 1',
      [periodo_id, area_id]
    );
    if (existingPicking.length > 0) {
      const [areaName] = await db.query('SELECT nombre FROM areas WHERE id = ?', [area_id]);
      const nombre = areaName[0]?.nombre || 'esta área';
      return res.status(400).json({ success: false, message: `Ya se registró un picking para "${nombre}" en este período. No se puede duplicar.` });
    }

    // Get area name for response
    const [areaRow] = await db.query('SELECT nombre FROM areas WHERE id = ?', [area_id]);
    const areaNombre = areaRow[0]?.nombre || '';

    const created = [];
    const alertas = [];
    const errors = [];

    for (const reg of registros) {
      const { producto_id, cantidad_entregada } = reg;
      if (!producto_id || cantidad_entregada === undefined) continue;

      const calculation = await calculatePickingQuantity(periodo_id, area_id, producto_id);
      if (calculation.error) {
        errors.push({ producto_id, error: calculation.error });
        continue;
      }

      let alerta = null;
      if (calculation.cantidad_encontrada > 0 && cantidad_entregada > calculation.cantidad_calculada) {
        const exceso = cantidad_entregada - calculation.cantidad_calculada;
        alerta = `Sobrestock de ${exceso} unidades. Registre como Movimiento Fuera del Picking.`;
      }

      const [result] = await db.query(
        'INSERT INTO picking (periodo_id, area_id, producto_id, cantidad_entregada, cantidad_calculada) VALUES (?, ?, ?, ?, ?)',
        [periodo_id, area_id, producto_id, cantidad_entregada, calculation.cantidad_calculada]
      );

      const [newPicking] = await db.query(
        `SELECT pk.*, p.nombre AS periodo_nombre, a.nombre AS area_nombre,
                pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
         FROM picking pk
         JOIN periodos p ON pk.periodo_id = p.id
         JOIN areas a ON pk.area_id = a.id
         JOIN productos pr ON pk.producto_id = pr.id
         WHERE pk.id = ?`,
        [result.insertId]
      );

      created.push(newPicking[0]);
      if (alerta) alertas.push(alerta);
    }

    if (created.length === 0) {
      const errMsg = errors.length > 0
        ? errors.map(e => e.error).join('. ')
        : 'No se pudo registrar ningún picking.';
      return res.status(400).json({ success: false, message: errMsg });
    }

    const msg = errors.length > 0
      ? `${created.length} picking(s) registrado(s). ${errors.length} con error.`
      : `${created.length} picking(s) registrado(s) para "${areaNombre}".`;

    res.status(201).json({
      success: true,
      message: msg,
      data: created,
      alertas: alertas.length > 0 ? alertas : undefined,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al registrar pickings' });
  }
};

module.exports.calculatePickingQuantity = calculatePickingQuantity;
