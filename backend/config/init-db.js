const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), override: true });

async function initDatabase() {
  const useSSL = process.env.DB_SSL === 'true';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined
  });

  const dbName = process.env.DB_NAME || 'suministros';

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Base de datos "${dbName}" creada/verificada.`);
    await connection.query(`USE \`${dbName}\``);

    const schema = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        nombre_completo VARCHAR(150) NOT NULL,
        rol ENUM('admin', 'lectura') NOT NULL DEFAULT 'lectura',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_usuario (usuario),
        INDEX idx_rol (rol)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_nombre (nombre),
        INDEX idx_codigo (codigo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS areas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL UNIQUE,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_nombre (nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS area_producto (
        id INT AUTO_INCREMENT PRIMARY KEY,
        area_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad_asignada INT NOT NULL DEFAULT 0,
        UNIQUE KEY unique_area_producto (area_id, producto_id),
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS periodos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado ENUM('activo', 'cerrado') DEFAULT 'activo',
        cuadra BOOLEAN DEFAULT NULL,
        fecha_cierre TIMESTAMP NULL,
        INDEX idx_estado (estado),
        INDEX idx_fecha (fecha_creacion)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS picking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        periodo_id INT NOT NULL,
        area_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad_entregada INT NOT NULL DEFAULT 0,
        cantidad_calculada INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
        INDEX idx_periodo (periodo_id),
        INDEX idx_area (area_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS auditorias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        periodo_id INT NOT NULL,
        area_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad_encontrada INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
        INDEX idx_periodo (periodo_id),
        INDEX idx_area (area_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS movimientos_fuera_picking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        periodo_id INT NOT NULL,
        area_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad INT NOT NULL DEFAULT 0,
        motivo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
        INDEX idx_periodo (periodo_id),
        INDEX idx_area (area_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS trupal_productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        codigo VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_nombre (nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS trupal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo ENUM('entrada', 'devolucion') NOT NULL,
        producto_id INT NOT NULL,
        placa VARCHAR(20),
        cantidad INT NOT NULL DEFAULT 1,
        fecha DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES trupal_productos(id) ON DELETE RESTRICT,
        INDEX idx_tipo (tipo),
        INDEX idx_producto (producto_id),
        INDEX idx_placa (placa),
        INDEX idx_fecha (fecha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.query(schema);

    // Migration: if old trupal table exists with 'producto' column, migrate it
    try {
      const [cols] = await connection.query(`SHOW COLUMNS FROM trupal LIKE 'producto'`);
      if (cols.length > 0) {
        console.log('🔄 Migrando tabla trupal (producto -> producto_id)...');
        await connection.query(`DROP TABLE IF EXISTS trupal`);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS trupal (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tipo ENUM('entrada', 'devolucion') NOT NULL,
            producto_id INT NOT NULL,
            placa VARCHAR(20),
            cantidad INT NOT NULL DEFAULT 1,
            fecha DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (producto_id) REFERENCES trupal_productos(id) ON DELETE RESTRICT,
            INDEX idx_tipo (tipo),
            INDEX idx_producto (producto_id),
            INDEX idx_placa (placa),
            INDEX idx_fecha (fecha)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabla trupal migrada exitosamente.');
      }
    } catch (e) { /* table might not exist yet, that's fine */ }

    console.log('✅ Tablas creadas/verificadas.');

    // Create default admin user
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Administrador General';
    if (!adminUsername || !adminPassword) {
      console.log('ℹ️  ADMIN_USERNAME/ADMIN_PASSWORD no definidos. Saltando creación de admin.'); return;
    }
    const [existing] = await connection.query('SELECT id FROM usuarios WHERE usuario = ?', [adminUsername]);
    if (existing.length === 0) {
      const hashedPass = await bcrypt.hash(adminPassword, 10);
      await connection.query(
        "INSERT INTO usuarios (usuario, password, nombre_completo, rol) VALUES (?, ?, ?, ?)",
        [adminUsername, hashedPass, adminName, 'admin']
      );
      console.log(`✅ Usuario administrador creado: ${adminUsername}`);
    } else {
      console.log('ℹ️  Usuario administrador ya existe.');
    }

    // Create default viewer user
    const viewerUsername = process.env.VIEWER_USERNAME;
    const viewerPassword = process.env.VIEWER_PASSWORD;
    const viewerName = process.env.VIEWER_NAME || 'Usuario de Solo Lectura';
    if (!viewerUsername || !viewerPassword) {
      console.log('ℹ️  VIEWER_USERNAME/VIEWER_PASSWORD no definidos. Saltando creación de viewer.');
    }
    const [existingViewer] = await connection.query('SELECT id FROM usuarios WHERE usuario = ?', [viewerUsername]);
    if (existingViewer.length === 0) {
      const hashedPass = await bcrypt.hash(viewerPassword, 10);
      await connection.query(
        "INSERT INTO usuarios (usuario, password, nombre_completo, rol) VALUES (?, ?, ?, ?)",
        [viewerUsername, hashedPass, viewerName, 'lectura']
      );
      console.log(`✅ Usuario de lectura creado: ${viewerUsername}`);
    } else {
      console.log('ℹ️  Usuario de lectura ya existe.');
    }

    console.log('\n🎉 Base de datos inicializada exitosamente.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

initDatabase();
