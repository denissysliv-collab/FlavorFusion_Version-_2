/**
 * Скрипт для создания первого администратора
 * 
 * Использование:
 *   node database/createAdmin.js <username> <email> <password>
 * 
 * Пример:
 *   node database/createAdmin.js admin admin@example.com mypassword123
 */

const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const [, , username, email, password] = process.argv;

  if (!username || !email || !password) {
    console.error('❌ Использование: node createAdmin.js <username> <email> <password>');
    process.exit(1);
  }

  try {
    // Проверяем, существует ли пользователь
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️ Пользователь уже существует. Назначаем роль администратора...');
      const userId = existingUser.rows[0].id;
      
      await pool.query(
        'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['admin', userId]
      );
      
      console.log(`✅ Пользователь "${username}" назначен администратором!`);
    } else {
      // Создаём нового пользователя с ролью администратора
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await pool.query(
        `INSERT INTO users (username, email, password_hash, role, avatar_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          username,
          email,
          passwordHash,
          'admin',
          'https://ui-avatars.com/api/?background=4CAF50&color=fff&name=A'
        ]
      );

      console.log(`✅ Администратор "${username}" успешно создан!`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  }
}

createAdmin();
