-- Миграция: добавление поля role для ролевой модели
-- Запуск: node backend/database/migrate.js

-- Добавляем поле role в таблицу users (если ещё не существует)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Комментарий к полю
COMMENT ON COLUMN users.role IS 'Роль пользователя: user, admin';

-- Опционально: создаём индекс для быстрого поиска по роли
-- CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Пример назначения админа (раскомментировать и изменить email при необходимости):
-- UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
