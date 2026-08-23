// Middleware to check for active period
const db = require('../config/database');

const requireActivePeriod = async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT id FROM periodos WHERE estado = 'activo' LIMIT 1");
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay ningún período activo. Debe crear y activar un período antes de operar.'
      });
    }
    req.activePeriodoId = rows[0].id;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al verificar período activo', error: error.message });
  }
};

module.exports = { requireActivePeriod };
