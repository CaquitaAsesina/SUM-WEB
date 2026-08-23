const db = require('../config/database');

// GET all trupal records with filters
exports.getAll = async (req, res) => {
  try {
    const { tipo, producto_id, placa, fecha_desde, fecha_hasta, buscar } = req.query;
    let query = `SELECT t.*, tp.nombre as producto_nombre, tp.codigo as producto_codigo
      FROM trupal t
      LEFT JOIN trupal_productos tp ON t.producto_id = tp.id
      WHERE 1=1`;
    const params = [];

    if (tipo) { query += ' AND t.tipo = ?'; params.push(tipo); }
    if (producto_id) { query += ' AND t.producto_id = ?'; params.push(producto_id); }
    if (placa) { query += ' AND t.placa LIKE ?'; params.push(`%${placa}%`); }
    if (fecha_desde) { query += ' AND t.fecha >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { query += ' AND t.fecha <= ?'; params.push(fecha_hasta); }
    if (buscar) {
      query += ' AND (tp.nombre LIKE ? OR tp.codigo LIKE ? OR t.placa LIKE ? OR t.tipo LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    query += ' ORDER BY t.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al obtener trupal:', error);
    res.status(500).json({ success: false, message: 'Error al obtener registros de Trupal' });
  }
};

// GET balance summary - per product
exports.getBalance = async (req, res) => {
  try {
    const { producto_id, placa, fecha_desde, fecha_hasta } = req.query;

    let whereClause = 'WHERE 1=1';
    const paramsP = [];

    if (producto_id) { whereClause += ' AND t.producto_id = ?'; paramsP.push(producto_id); }
    if (placa) { whereClause += ' AND t.placa LIKE ?'; paramsP.push(`%${placa}%`); }
    if (fecha_desde) { whereClause += ' AND t.fecha >= ?'; paramsP.push(fecha_desde); }
    if (fecha_hasta) { whereClause += ' AND t.fecha <= ?'; paramsP.push(fecha_hasta); }

    // Totals
    const [totals] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN t.tipo = 'entrada' THEN t.cantidad ELSE 0 END), 0) as total_entradas,
        COALESCE(SUM(CASE WHEN t.tipo = 'devolucion' THEN t.cantidad ELSE 0 END), 0) as total_devoluciones
      FROM trupal t ${whereClause}
    `, paramsP);

    const totalEntradas = totals[0].total_entradas;
    const totalDevoluciones = totals[0].total_devoluciones;

    // Per product breakdown
    const [perProduct] = await db.query(`
      SELECT 
        tp.id as producto_id,
        tp.nombre as producto,
        tp.codigo,
        COALESCE(SUM(CASE WHEN t.tipo = 'entrada' THEN t.cantidad ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN t.tipo = 'devolucion' THEN t.cantidad ELSE 0 END), 0) as devoluciones,
        COALESCE(SUM(CASE WHEN t.tipo = 'entrada' THEN t.cantidad ELSE -t.cantidad END), 0) as saldo
      FROM trupal t
      LEFT JOIN trupal_productos tp ON t.producto_id = tp.id
      ${whereClause}
      GROUP BY tp.id, tp.nombre, tp.codigo
      ORDER BY saldo DESC
    `, paramsP);

    res.json({
      success: true,
      data: {
        total_entradas: totalEntradas,
        total_devoluciones: totalDevoluciones,
        balance: totalEntradas - totalDevoluciones,
        por_producto: perProduct
      }
    });
  } catch (error) {
    console.error('Error al obtener balance:', error);
    res.status(500).json({ success: false, message: 'Error al calcular balance' });
  }
};

// GET one record
exports.getById = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, tp.nombre as producto_nombre, tp.codigo as producto_codigo
      FROM trupal t
      LEFT JOIN trupal_productos tp ON t.producto_id = tp.id
      WHERE t.id = ?
    `, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener registro' });
  }
};

// CREATE
exports.create = async (req, res) => {
  try {
    const { tipo, producto_id, placa, cantidad, fecha } = req.body;

    if (!tipo || !['entrada', 'devolucion'].includes(tipo)) {
      return res.status(400).json({ success: false, message: 'Tipo inválido. Debe ser "entrada" o "devolucion".' });
    }
    if (!producto_id) {
      return res.status(400).json({ success: false, message: 'Debe seleccionar un producto.' });
    }
    // Verify product exists
    const [prod] = await db.query('SELECT id FROM trupal_productos WHERE id = ?', [producto_id]);
    if (prod.length === 0) {
      return res.status(400).json({ success: false, message: 'El producto seleccionado no existe.' });
    }
    if (!cantidad || cantidad < 1) {
      return res.status(400).json({ success: false, message: 'La cantidad debe ser al menos 1.' });
    }
    if (!fecha) {
      return res.status(400).json({ success: false, message: 'La fecha es obligatoria.' });
    }
    if (tipo === 'entrada' && (!placa || placa.trim().length < 1)) {
      return res.status(400).json({ success: false, message: 'La placa del camión es obligatoria para entregas.' });
    }

    const [result] = await db.query(
      'INSERT INTO trupal (tipo, producto_id, placa, cantidad, fecha) VALUES (?, ?, ?, ?, ?)',
      [tipo, producto_id, placa ? placa.trim() : null, parseInt(cantidad), fecha]
    );

    const [newRecord] = await db.query(`
      SELECT t.*, tp.nombre as producto_nombre, tp.codigo as producto_codigo
      FROM trupal t LEFT JOIN trupal_productos tp ON t.producto_id = tp.id
      WHERE t.id = ?
    `, [result.insertId]);
    res.status(201).json({ success: true, message: 'Registro creado exitosamente', data: newRecord[0] });
  } catch (error) {
    console.error('Error al crear registro:', error);
    res.status(500).json({ success: false, message: 'Error al crear registro' });
  }
};

// UPDATE
exports.update = async (req, res) => {
  try {
    const { tipo, producto_id, placa, cantidad, fecha } = req.body;
    const { id } = req.params;

    const [existing] = await db.query('SELECT * FROM trupal WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    if (tipo && !['entrada', 'devolucion'].includes(tipo)) {
      return res.status(400).json({ success: false, message: 'Tipo inválido.' });
    }
    if (producto_id) {
      const [prod] = await db.query('SELECT id FROM trupal_productos WHERE id = ?', [producto_id]);
      if (prod.length === 0) return res.status(400).json({ success: false, message: 'Producto no encontrado.' });
    }
    if (cantidad !== undefined && cantidad < 1) {
      return res.status(400).json({ success: false, message: 'La cantidad debe ser al menos 1.' });
    }

    const tipoFinal = tipo || existing[0].tipo;
    const prodFinal = producto_id || existing[0].producto_id;
    const placaFinal = placa !== undefined ? (placa.trim() || null) : existing[0].placa;

    if (tipoFinal === 'entrada' && !placaFinal) {
      return res.status(400).json({ success: false, message: 'La placa es obligatoria para entregas.' });
    }

    await db.query(
      'UPDATE trupal SET tipo = ?, producto_id = ?, placa = ?, cantidad = ?, fecha = ? WHERE id = ?',
      [
        tipoFinal,
        prodFinal,
        placaFinal,
        cantidad ? parseInt(cantidad) : existing[0].cantidad,
        fecha || existing[0].fecha,
        id
      ]
    );

    const [updated] = await db.query(`
      SELECT t.*, tp.nombre as producto_nombre, tp.codigo as producto_codigo
      FROM trupal t LEFT JOIN trupal_productos tp ON t.producto_id = tp.id
      WHERE t.id = ?
    `, [id]);
    res.json({ success: true, message: 'Registro actualizado exitosamente', data: updated[0] });
  } catch (error) {
    console.error('Error al actualizar registro:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar registro' });
  }
};

// DELETE
exports.remove = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM trupal WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
    await db.query('DELETE FROM trupal WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Registro eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar registro' });
  }
};
