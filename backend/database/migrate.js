/**
 * database/migrate.js
 * Применяет миграции из папки migrations/ и основную схему
 */
const pool = require('./pool');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    // 1. Применяем основную схему
    console.log('📦 Применение основной схемы...');
    const schemaSql = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    await pool.query(schemaSql);
    console.log('✅ Основная схема применена');

    // 2. Применяем миграции из папки migrations/
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Сортируем по имени для порядка применения
      
      for (const file of files) {
        console.log(`🔄 Применение миграции: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        console.log(`✅ Миграция ${file} применена`);
      }
    }

    console.log('\n🎉 Все миграции успешно применены!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка миграции:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

migrate();
