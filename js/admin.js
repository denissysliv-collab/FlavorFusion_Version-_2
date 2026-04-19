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
                    <td>${escapeHtml(user.username || '—')}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${user.is_admin ? '✅ Да' : '❌ Нет'}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-sm btn-primary view-user-recipes" data-id="${user.id}" data-username="${escapeHtml(user.username || user.email)}">📖 Рецепты</button>
                        <button class="btn-sm btn-warning toggle-role" data-id="${user.id}" data-role="${user.is_admin}">${user.is_admin ? 'Снять админа' : 'Назначить админом'}</button>
                        <button class="btn-sm btn-danger delete-user" data-id="${user.id}">Удалить</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        document.querySelectorAll('.view-user-recipes').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.id;
                const username = btn.dataset.username;
                showUserRecipes(userId, username);
            });
        });

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

async function showUserRecipes(userId, username) {
    const recipesTab = document.querySelector('.tab-btn[data-tab="recipes"]');
    const usersTab = document.querySelector('.tab-btn[data-tab="users"]');
    const recipesFilter = document.getElementById('recipesFilter');
    
    if (usersTab) usersTab.classList.remove('active');
    if (recipesTab) recipesTab.classList.add('active');
    if (recipesFilter) recipesFilter.style.display = 'flex';
    
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await res.json();
        
        const searchInput = document.getElementById('authorSearch');
        if (searchInput && user.email) {
            searchInput.value = user.email;
        }
        
        await loadRecipes();
    } catch (err) {
        console.error('Ошибка получения данных пользователя:', err);
        await loadRecipes();
    }
}

async function loadRecipes() {
    const container = document.getElementById('tabContent');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка рецептов...</div>';
    const searchInput = document.getElementById('authorSearch');
    const searchQuery = searchInput ? searchInput.value : '';
    
    try {
        const res = await fetch(`${API_BASE}/admin/recipes?page=1&limit=50&search=${encodeURIComponent(searchQuery)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        let filterHtml = `
            <div class="filter-bar">
                <input type="text" id="authorSearch" placeholder="🔍 Поиск по email или имени автора" value="${escapeHtml(searchQuery)}">
                <button id="searchBtn" class="btn-sm btn-primary">🔍 Найти</button>
                <button id="resetSearchBtn" class="btn-sm btn-secondary">🔄 Сбросить</button>
            </div>
        `;
        
        if (!data.recipes || data.recipes.length === 0) {
            container.innerHTML = filterHtml + '<p style="text-align: center; padding: 40px;">📭 Нет рецептов</p>';
            attachSearchHandlers();
            return;
        }
        
        let html = filterHtml + '<div class="recipes-grid">';
        data.recipes.forEach(recipe => {
            let imageUrl = recipe.image_url;
            if (!imageUrl || imageUrl === '' || imageUrl === 'null') {
                imageUrl = 'https://via.placeholder.com/300x200?text=🍽️+Нет+изображения';
            }
            
            let avatarUrl = recipe.author_avatar;
            if (!avatarUrl || avatarUrl === '' || avatarUrl === 'null') {
                avatarUrl = 'https://via.placeholder.com/40x40?text=👤';
            }
            
            const authorDisplay = recipe.author_name || (recipe.author_email ? recipe.author_email.split('@')[0] : 'Unknown');
            const description = recipe.description || 'Нет описания';
            
            html += `
                <div class="recipe-card fade-in" data-id="${recipe.id}" style="cursor: pointer;">
                    <div class="recipe-image">
                        <img src="${imageUrl}" alt="${escapeHtml(recipe.title)}" style="width:100%; height:180px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/300x200?text=🍽️+Нет+изображения'">
                        <div class="recipe-actions">
                            <button class="btn-action btn-delete delete-recipe" data-id="${recipe.id}" title="Удалить">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="recipe-content">
                        <h3 class="recipe-title">${escapeHtml(recipe.title)}</h3>
                        <div class="recipe-author">
                            <img src="${avatarUrl}" alt="avatar" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">
                            <span>${escapeHtml(authorDisplay)}</span>
                        </div>
                        <p class="recipe-description">${escapeHtml(description.substring(0, 80))}${description.length > 80 ? '...' : ''}</p>
                        <div class="recipe-meta">
                            <span>📅 ${new Date(recipe.created_at).toLocaleDateString()}</span>
                            <span>📧 ${escapeHtml(recipe.author_email || '—')}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
        
        attachSearchHandlers();
        
        document.querySelectorAll('.recipe-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-recipe')) return;
                const recipeId = card.dataset.id;
                window.open(`recipe-detail.html?id=${recipeId}`, '_blank');
            });
        });
        
        document.querySelectorAll('.delete-recipe').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const recipeId = btn.dataset.id;
                if (confirm('Удалить этот рецепт?')) {
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

function attachSearchHandlers() {
    const searchBtn = document.getElementById('searchBtn');
    const resetBtn = document.getElementById('resetSearchBtn');
    const searchInput = document.getElementById('authorSearch');
    
    if (searchBtn) searchBtn.onclick = () => loadRecipes();
    if (resetBtn) resetBtn.onclick = () => {
        if (searchInput) searchInput.value = '';
        loadRecipes();
    };
    if (searchInput) searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') loadRecipes();
    };
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
    const recipesFilter = document.getElementById('recipesFilter');
    const searchInput = document.getElementById('authorSearch');
    
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            
            if (recipesFilter) {
                recipesFilter.style.display = tab === 'recipes' ? 'flex' : 'none';
            }
            
            if (tab === 'recipes' && searchInput) {
                searchInput.value = '';
            }
            
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
        attachSearchHandlers();
    }
})();