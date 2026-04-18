-- Миграция: добавление поля is_admin для администратора
-- Запуск: node backend/database/migrate.js

-- Добавляем поле is_admin в таблицу users (если ещё не существует)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Комментарий к полю
COMMENT ON COLUMN users.is_admin IS 'Флаг администратора: true = имеет доступ к админ-панели';

-- Опционально: создаём индекс для быстрого поиска админов (если их будет много)
-- CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Пример назначения админа (раскомментировать и изменить email при необходимости):
-- UPDATE users SET is_admin = TRUE WHERE email = 'admin@example.com';
