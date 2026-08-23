const db = require('../config/database');

// GET dashboard summary
exports.getSummary = async (req, res) => {
  try {
    // Get period stats
    const [totalPeriodos] = await db.query('SELECT COUNT(*) as total FROM periodos');
    const [activos] = await db.query("SELECT COUNT(*) as total FROM periodos WHERE estado = 'activo'");
    const [cerrados] = await db.query("SELECT COUNT(*) as total FROM periodos WHERE estado = 'cerrado'");
    const [cuadraron] = await db.query("SELECT COUNT(*) as total FROM periodos WHERE cuadra = 1");
    const [noCuadraron] = await db.query("SELECT COUNT(*) as total FROM periodos WHERE cuadra = 0");

    // Get active period info
    const [activePeriod] = await db.query("SELECT * FROM periodos WHERE estado = 'activo' ORDER BY fecha_creacion DESC LIMIT 1");

    // Get product stats
    const [totalProductos] = await db.query('SELECT COUNT(*) as total FROM productos');
    const [totalAreas] = await db.query('SELECT COUNT(*) as total FROM areas');
    const [totalAsignaciones] = await db.query('SELECT COUNT(*) as total FROM area_producto');

    // Get products with most movements outside picking
    const [productosMasMovimientos] = await db.query(`
      SELECT pr.id, pr.nombre, pr.codigo, COUNT(m.id) as total_movimientos, COALESCE(SUM(m.cantidad), 0) as total_cantidad
      FROM movimientos_fuera_picking m
      JOIN productos pr ON m.producto_id = pr.id
      GROUP BY pr.id, pr.nombre, pr.codigo
      ORDER BY total_movimientos DESC
      LIMIT 5
    `);

    // Get areas with most incidents (movements)
    const [areasMasIncidencias] = await db.query(`
      SELECT a.id, a.nombre, COUNT(m.id) as total_movimientos, COALESCE(SUM(m.cantidad), 0) as total_cantidad
      FROM movimientos_fuera_picking m
      JOIN areas a ON m.area_id = a.id
      GROUP BY a.id, a.nombre
      ORDER BY total_movimientos DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        periodos: {
          total: totalPeriodos[0].total,
          activos: activos[0].total,
          cerrados: cerrados[0].total,
          cuadraron: cuadraron[0].total,
          noCuadraron: noCuadraron[0].total,
          porcentajeCuadre: cerrados[0].total > 0 ? Math.round((cuadraron[0].total / cerrados[0].total) * 100) : 0
        },
        activePeriod: activePeriod.length > 0 ? activePeriod[0] : null,
        productos: totalProductos[0].total,
        areas: totalAreas[0].total,
        asignaciones: totalAsignaciones[0].total,
        productosMasMovimientos,
        areasMasIncidencias
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener resumen del dashboard' });
  }
};

// GET area status for active period
exports.getAreaStatus = async (req, res) => {
  try {
    const [activePeriod] = await db.query("SELECT id FROM periodos WHERE estado = 'activo' ORDER BY fecha_creacion DESC LIMIT 1");
    if (activePeriod.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const periodoId = activePeriod[0].id;

    const [areas] = await db.query(`
      SELECT a.id, a.nombre
      FROM areas a
      JOIN area_producto ap ON a.id = ap.area_id
      GROUP BY a.id, a.nombre
      ORDER BY a.nombre
    `);

    const areaStatus = [];

    for (const area of areas) {
      // Get assignments for this area
      const [assignments] = await db.query(
        `SELECT ap.*, pr.nombre as producto_nombre
         FROM area_producto ap
         JOIN productos pr ON ap.producto_id = pr.id
         WHERE ap.area_id = ?`,
        [area.id]
      );

      // Get picking count for this area in active period
      const [picks] = await db.query(
        'SELECT COUNT(*) as total FROM picking WHERE periodo_id = ? AND area_id = ?',
        [periodoId, area.id]
      );

      // Get movements count for this area in active period
      const [movements] = await db.query(
        'SELECT COUNT(*) as total, COALESCE(SUM(cantidad), 0) as total_cantidad FROM movimientos_fuera_picking WHERE periodo_id = ? AND area_id = ?',
        [periodoId, area.id]
      );

      // Get audit count for this area in active period
      const [audits] = await db.query(
        'SELECT COUNT(*) as total FROM auditorias WHERE periodo_id = ? AND area_id = ?',
        [periodoId, area.id]
      );

      areaStatus.push({
        id: area.id,
        nombre: area.nombre,
        totalAsignaciones: assignments.length,
        pickingRealizado: picks[0].total,
        movimientosRealizados: movements[0].total,
        movimientosCantidad: movements[0].total_cantidad,
        auditoriasRealizadas: audits[0].total
      });
    }

    res.json({ success: true, data: areaStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener estado de áreas' });
  }
};

// GET picking compliance chart data
exports.getComplianceData = async (req, res) => {
  try {
    let periodoFilter = '';
    const params = [];

    if (req.query.periodo_id) {
      periodoFilter = ' AND pk.periodo_id = ?';
      params.push(req.query.periodo_id);
    }

    const [data] = await db.query(`
      SELECT a.nombre as area_nombre, a.id as area_id,
             COUNT(pk.id) as total_pickings,
             SUM(CASE WHEN pk.cantidad_entregada = pk.cantidad_calculada THEN 1 ELSE 0 END) as pickings_estandar,
             SUM(CASE WHEN pk.cantidad_entregada > pk.cantidad_calculada THEN 1 ELSE 0 END) as pickings_exceso,
             SUM(CASE WHEN pk.cantidad_entregada < pk.cantidad_calculada THEN 1 ELSE 0 END) as pickings_deficit,
             SUM(CASE WHEN pk.cantidad_entregada = 0 THEN 1 ELSE 0 END) as pickings_cero
      FROM picking pk
      JOIN areas a ON pk.area_id = a.id
      WHERE 1=1 ${periodoFilter}
      GROUP BY a.id, a.nombre
      ORDER BY a.nombre
    `, params);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener datos de cumplimiento' });
  }
};

// GET movements summary by area and period
exports.getMovementsSummary = async (req, res) => {
  try {
    const [data] = await db.query(`
      SELECT a.nombre as area_nombre, p.nombre as periodo_nombre,
             COUNT(m.id) as total_movimientos,
             COALESCE(SUM(m.cantidad), 0) as total_cantidad
      FROM movimientos_fuera_picking m
      JOIN areas a ON m.area_id = a.id
      JOIN periodos p ON m.periodo_id = p.id
      GROUP BY a.nombre, p.nombre
      ORDER BY p.fecha_creacion DESC, a.nombre
    `);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener resumen de movimientos' });
  }
};
