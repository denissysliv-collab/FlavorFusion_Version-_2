// js/admin.js
const API_BASE = 'http://localhost:5000/api';
const token = localStorage.getItem('token');

async function checkAdminAccess() {
    if (!token) {
        window.location.href = 'registration/login.html';
        return false;
    }
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Not authorized');
        const user = await res.json();
        if (!user.is_admin) {
            alert('Доступ запрещён. Вы не администратор.');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    } catch (err) {
        console.error(err);
        window.location.href = 'registration/login.html';
        return false;
    }
}

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await res.json();
        const grid = document.getElementById('statsGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="stat-card"><i class="fas fa-users"></i><h3>${stats.users}</h3><p>Пользователей</p></div>
                <div class="stat-card"><i class="fas fa-utensils"></i><h3>${stats.recipes}</h3><p>Рецептов</p></div>
                <div class="stat-card"><i class="fas fa-heart"></i><h3>${stats.likes}</h3><p>Лайков</p></div>
                <div class="stat-card"><i class="fas fa-bookmark"></i><h3>${stats.favorites}</h3><p>В избранном</p></div>
            `;
        }
    } catch (err) {
        console.error('Ошибка загрузки статистики', err);
    }
}

async function loadUsers() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка пользователей...</div>';
    try {
        const res = await fetch(`${API_BASE}/admin/users?page=1&limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.users || data.users.length === 0) {
            container.innerHTML = '<p>Нет пользователей</p>';
            return;
        }
        let html = '<table><thead><tr><th>ID</th><th>Имя</th><th>Email</th><th>Админ</th><th>Дата рег.</th><th>Действия</th></tr></thead><tbody>';
        data.users.forEach(user => {
            html += `
                <tr>
                    <td>${user.id}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${user.is_admin ? '✅ Да' : '❌ Нет'}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-sm btn-warning toggle-role" data-id="${user.id}" data-role="${user.is_admin}">${user.is_admin ? 'Снять админа' : 'Назначить админом'}</button>
                        <button class="btn-sm btn-danger delete-user" data-id="${user.id}">Удалить</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        document.querySelectorAll('.toggle-role').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const currentRole = btn.dataset.role === 'true';
                if (confirm(`Вы уверены, что хотите ${currentRole ? 'снять права админа' : 'назначить админом'} пользователя?`)) {
                    await fetch(`${API_BASE}/admin/users/${userId}/role`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ is_admin: !currentRole })
                    });
                    loadUsers();
                    loadStats();
                }
            });
        });

        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                if (confirm('Удалить пользователя? Все его рецепты, лайки и подписки будут удалены навсегда.')) {
                    await fetch(`${API_BASE}/admin/users/${userId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    loadUsers();
                    loadStats();
                }
            });
        });
    } catch (err) {
        container.innerHTML = '<p>Ошибка загрузки пользователей</p>';
        console.error(err);
    }
}

async function loadRecipes() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка рецептов...</div>';
    try {
        const res = await fetch(`${API_BASE}/admin/recipes?page=1&limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.recipes || data.recipes.length === 0) {
            container.innerHTML = '<p>Нет рецептов</p>';
            return;
        }
        let html = '</table><thead><tr><th>ID</th><th>Название</th><th>Автор</th><th>Дата создания</th><th>Действия</th></tr></thead><tbody>';
        data.recipes.forEach(recipe => {
            html += `
                <tr>
                    <td>${recipe.id}</td>
                    <td><a href="recipe-detail.html?id=${recipe.id}" target="_blank">${escapeHtml(recipe.title)}</a></td>
                    <td>${escapeHtml(recipe.author_name || 'Unknown')}</td>
                    <td>${new Date(recipe.created_at).toLocaleDateString()}</td>
                    <td><button class="btn-sm btn-danger delete-recipe" data-id="${recipe.id}">Удалить</button></td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        document.querySelectorAll('.delete-recipe').forEach(btn => {
            btn.addEventListener('click', async () => {
                const recipeId = btn.dataset.id;
                if (confirm('Удалить рецепт?')) {
                    await fetch(`${API_BASE}/admin/recipes/${recipeId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    loadRecipes();
                    loadStats();
                }
            });
        });
    } catch (err) {
        container.innerHTML = '<p>Ошибка загрузки рецептов</p>';
        console.error(err);
    }
}

async function loadActivity() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка логов...</div>';
    try {
        const res = await fetch(`${API_BASE}/admin/activity?page=1&limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.logs || data.logs.length === 0) {
            container.innerHTML = '<p>Нет записей</p>';
            return;
        }
        let html = '<table><thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th></tr></thead><tbody>';
        data.logs.forEach(log => {
            html += `
                <tr>
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${escapeHtml(log.username || log.user_id)}</td>
                    <td>${escapeHtml(log.action)}</td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<p>Ошибка загрузки логов</p>';
        console.error(err);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            if (tab === 'users') loadUsers();
            else if (tab === 'recipes') loadRecipes();
            else if (tab === 'activity') loadActivity();
        });
    });
    loadUsers();
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('rememberedEmail');
        window.location.href = 'index.html';
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

(async () => {
    const isAdmin = await checkAdminAccess();
    if (isAdmin) {
        await loadStats();
        setupTabs();
    }
})();