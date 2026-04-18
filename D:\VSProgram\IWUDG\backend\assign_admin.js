const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function assignAdmin() {
  const email = 'denisysliv@gmail.com';
  
  try {
    console.log(`🔍 Поиск пользователя с email: ${email}...`);
    
    // Сначала проверим, существует ли пользователь
    const checkResult = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length === 0) {
      console.error(`❌ Пользователь с email ${email} не найден в базе данных.`);
      return;
    }

    const user = checkResult.rows[0];
    console.log(`✅ Пользователь найден: ${user.email}, текущая роль: ${user.role}`);

    if (user.role === 'admin') {
      console.log('ℹ️  Пользователь уже является администратором.');
      return;
    }

    // Обновляем роль
    const updateResult = await pool.query(
      'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role',
      ['admin', email]
    );

    console.log('🎉 Успешно!');
    console.log(`👤 Пользователь ${updateResult.rows[0].email} теперь имеет роль: ${updateResult.rows[0].role}`);
    console.log('🚀 Теперь вы можете войти в систему под этим пользователем и перейти на страницу /admin.html');

  } catch (error) {
    console.error('❌ Ошибка при обновлении роли:', error.message);
  } finally {
    await pool.end();
  }
}

assignAdmin();
