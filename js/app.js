/* ============================================
   Nieta Studio - 移动端主应用入口
   纯移动端：底部 Tab 导航、路由、页面渲染、Token 管理
   ============================================ */

const App = (() => {
  let currentPage = null;
  let currentRoute = 'generate';

  // ============ 路由配置 ============
  const routeConfig = [
    { route: 'generate', label: '创作', pageClass: GeneratePage },
    { route: 'works',    label: '作品', pageClass: WorksPage },
    { route: 'feed',     label: '发现', pageClass: FeedPage },
  ];

  const routeMap = {};
  routeConfig.forEach(r => { routeMap[r.route] = r; });

  // ============ 路由导航 ============
  function navigateTo(route) {
    if (!routeMap[route]) return;
    currentRoute = route;
    const config = routeMap[route];

    // 更新 Tab 高亮
    document.querySelectorAll('#mobile-tab-bar .mobile-tab[data-route]').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    // 更新顶部标题
    const mobileTitle = document.getElementById('mobile-header-title');
    if (mobileTitle) {
      mobileTitle.textContent = config.label;
    }

    // 销毁旧页面
    if (currentPage && currentPage.destroy) {
      currentPage.destroy();
      currentPage = null;
    }

    // 渲染新页面
    const container = document.getElementById('page-container');
    if (!container) return;

    container.innerHTML = '';
    currentPage = new config.pageClass(container);
  }

  // ============ Token 面板 ============
  function toggleTokenPanel() {
    const panel = document.getElementById('token-panel');
    const overlay = document.getElementById('token-panel-overlay');
    if (!panel || !overlay) return;
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    overlay.classList.toggle('open', !isOpen);
    if (!isOpen) {
      const input = document.getElementById('token-input');
      if (input) input.value = API.getToken();
    }
  }

  function saveToken() {
    const input = document.getElementById('token-input');
    if (!input) return;
    const token = input.value.trim();
    if (token) {
      API.setToken(token);
      Components.Toast.success('Token 已保存');
      toggleTokenPanel();
      updateUserInfo();
    } else {
      API.clearToken();
      Components.Toast.info('Token 已清除');
      toggleTokenPanel();
      updateUserInfo();
    }
  }

  // ============ 用户信息 ============
  async function updateUserInfo() {
    if (!API.isAuthenticated()) return;
    try {
      await API.User.getInfo();
    } catch (err) {
      // Token 无效，静默处理
    }
  }

  // ============ 绑定 Tab 栏事件 ============
  function bindTabBar() {
    const tabBar = document.getElementById('mobile-tab-bar');
    if (!tabBar) return;

    tabBar.querySelectorAll('.mobile-tab[data-route]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.route));
    });
  }

  // ============ 绑定 Token 面板事件 ============
  function bindTokenPanelEvents() {
    // Token 按钮
    const tokenBtn = document.getElementById('token-btn-mobile');
    if (tokenBtn) {
      tokenBtn.addEventListener('click', toggleTokenPanel);
    }

    // 遮罩层关闭
    const overlay = document.getElementById('token-panel-overlay');
    if (overlay) {
      overlay.addEventListener('click', toggleTokenPanel);
    }

    // 关闭按钮
    const closeBtn = document.getElementById('token-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', toggleTokenPanel);
    }

    // 保存按钮
    const saveBtn = document.getElementById('token-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveToken);
    }

    // 回车保存
    const tokenInput = document.getElementById('token-input');
    if (tokenInput) {
      tokenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveToken();
      });
    }

    // 测试连接
    const testBtn = document.getElementById('token-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('token-status');
        const token = document.getElementById('token-input').value.trim();
        if (!token) {
          statusEl.innerHTML = '<span class="text-sm" style="color:var(--brand-red)">请先输入 Token</span>';
          return;
        }
        statusEl.innerHTML = '<div class="spinner spinner-sm"></div><span class="text-sm text-secondary">测试中...</span>';
        try {
          API.setToken(token);
          const data = await API.User.getInfo();
          const user = data.data || data;
          statusEl.innerHTML = `<span class="text-sm" style="color:var(--brand-green)">✓ 连接成功</span><span class="text-sm text-secondary">${user.nickname || user.name || '用户'}</span>`;
        } catch (err) {
          statusEl.innerHTML = `<span class="text-sm" style="color:var(--brand-red)">✗ 连接失败: ${err.message}</span>`;
        }
      });
    }

    // 清除 Token
    const clearBtn = document.getElementById('token-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const tokenInput = document.getElementById('token-input');
        const statusEl = document.getElementById('token-status');
        if (tokenInput) tokenInput.value = '';
        API.clearToken();
        if (statusEl) statusEl.innerHTML = '<span class="text-sm text-tertiary">Token 已清除</span>';
        updateUserInfo();
        Components.Toast.info('Token 已清除');
      });
    }
  }

  // ============ 初始化 ============
  function init() {
    bindTabBar();
    bindTokenPanelEvents();
    updateUserInfo();
    navigateTo(currentRoute);
  }

  return { init, navigateTo, updateUserInfo };
})();

// 启动
document.addEventListener('DOMContentLoaded', App.init);
