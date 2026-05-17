document.addEventListener('DOMContentLoaded', function() {
  
  // 配置
  const config = {
    correctPassword: '10021021',
    sessionKey: 'coffer_authenticated',
    postsJsonPath: '/coffer/private-posts.json'
  };

  // DOM元素
  const passwordSection = document.getElementById('passwordSection');
  const postsSection = document.getElementById('postsSection');
  const passwordInput = document.getElementById('passwordInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const errorMessage = document.getElementById('errorMessage');
  const loadingState = document.getElementById('loadingState');
  const postsGrid = document.getElementById('postsGrid');
  const emptyState = document.getElementById('emptyState');
  const postsCount = document.getElementById('postsCount');
  const searchBox = document.getElementById('searchBox');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const container = document.querySelector('.coffer-container');

  let allPosts = [];
  let filteredPosts = [];
  let currentFilter = 'all';

  // 检查DOM元素是否存在
  if (!passwordSection || !postsSection || !passwordInput || !unlockBtn) {
    console.error('关键DOM元素未找到');
    return;
  }


  // 检查是否已经验证过密码
  function checkAuthentication() {
    const isAuthenticated = sessionStorage.getItem(config.sessionKey) === 'true';
    if (isAuthenticated) {
      showPostsSection();
      loadPosts();
    }
  }

  // 密码验证
  function verifyPassword() {
    const inputPassword = passwordInput.value.trim();

    if (inputPassword === config.correctPassword) {
      sessionStorage.setItem(config.sessionKey, 'true');
      
      // 先隐藏密码区域
      hidePasswordSection();
      
      // 等待密码区域完全隐藏后再显示文章区域
      setTimeout(() => {
        showPostsSection();
        loadPosts();
      }, 600); // 等待密码区域动画完成

      passwordInput.value = '';
      hideError();
    } else {
      showError();
      passwordInput.value = '';
      passwordInput.focus();

      passwordInput.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
        passwordInput.style.animation = '';
      }, 500);
    }
  }

  // 显示错误信息
  function showError() {
    errorMessage.classList.add('show');
    setTimeout(() => {
      hideError();
    }, 3000);
  }

  // 隐藏错误信息
  function hideError() {
    errorMessage.classList.remove('show');
  }

  // 隐藏密码区域
  function hidePasswordSection() {
    passwordSection.classList.add('hidden');
  }

  // 显示文章区域
  function showPostsSection() {
    postsSection.classList.add('visible');
    if (container) {
      container.classList.add('authenticated');
    }
  }

  // 加载私密文章
  async function loadPosts() {
    try {
      loadingState.style.display = 'block';
      emptyState.style.display = 'none';
      postsGrid.innerHTML = '';

      const response = await fetch(config.postsJsonPath);
      if (!response.ok) {
        throw new Error('无法加载文章列表');
      }

      allPosts = await response.json();
      filteredPosts = [...allPosts];


      if (allPosts.length === 0) {
        showEmptyState();
      } else {
        renderPosts();
        updatePostsCount();
      }

    } catch (error) {
      console.error('加载文章失败:', error);
      showEmptyState();
    } finally {
      loadingState.style.display = 'none';
    }
  }

  // 渲染文章列表
  function renderPosts() {
    
    if (!postsGrid) {
      console.error('postsGrid元素不存在');
      return;
    }

    postsGrid.innerHTML = '';

    if (filteredPosts.length === 0) {
      postsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.6);"><div style="font-size: 24px; margin-bottom: 10px;">🔍</div><div>没有找到匹配的文章</div></div>';
      return;
    }

    filteredPosts.forEach((post, index) => {
      try {
        const postCard = createPostCard(post, index);
        if (postCard) {
          postsGrid.appendChild(postCard);
        }
      } catch (error) {
        console.error('创建文章卡片失败:', error, post);
      }
    });
    
  }

  // 创建文章卡片
  function createPostCard(post, index) {
    const card = document.createElement('div');
    card.className = 'post-card fade-in';
    card.style.animationDelay = (index * 0.1) + 's';

    // 格式化日期
    const formatDate = (dateStr) => {
      if (!dateStr) return '未知日期';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        return dateStr;
      }
    };

    // 格式化文件大小
    const formatWordCount = (count) => {
      if (count < 1000) return count + ' 字';
      return (count / 1000).toFixed(1) + 'k 字';
    };

    // 生成标签HTML
    const tagsHtml = post.tags && post.tags.length > 0 
      ? post.tags.map(tag => '<span class="post-tag">' + tag + '</span>').join('')
      : '';

    // 生成封面图片HTML
    const coverHtml = post.cover 
      ? '<img src="' + post.cover + '" alt="' + post.title + '" class="post-cover" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
        '<div class="post-cover-placeholder" style="display: none;">📄</div>'
      : '<div class="post-cover-placeholder">📄</div>';

    const excerptHtml = post.excerpt ? '<p class="post-excerpt">' + post.excerpt + '</p>' : '';
    const tagsSection = tagsHtml ? '<div class="post-tags">' + tagsHtml + '</div>' : '';
    const lastModifiedText = post.lastModified ? '更新于 ' + formatDate(post.lastModified) : '';

    card.innerHTML = 
      coverHtml +
      '<h3 class="post-title">' + post.title + '</h3>' +
      '<div class="post-meta">' +
        '<div class="post-date">' +
          '<span>📅</span>' +
          '<span>' + formatDate(post.date) + '</span>' +
        '</div>' +
        '<div class="post-stats">' +
          '<span>📝 ' + formatWordCount(post.wordCount) + '</span>' +
        '</div>' +
      '</div>' +
      excerptHtml +
      tagsSection +
      '<div class="post-actions">' +
        '<button class="read-btn" onclick="openPost(\'' + post.filename + '\')">' +
          '📖 阅读文章' +
        '</button>' +
        '<div class="post-info">' +
          lastModifiedText +
        '</div>' +
      '</div>';

    return card;
  }

  // 打开文章
  window.openPost = function(filename) {
    // 将.md文件名转换为.html路径
    const htmlFilename = filename.replace('.md', '.html');
    const postUrl = '/coffer/private-posts/' + htmlFilename;
    
    // 直接在新标签页打开文章
    window.open(postUrl, '_blank');
  };

  // 显示空状态
  function showEmptyState() {
    loadingState.style.display = 'none';
    emptyState.style.display = 'block';
    postsGrid.innerHTML = '';
  }

  // 更新文章数量
  function updatePostsCount() {
    postsCount.textContent = '共 ' + filteredPosts.length + ' 篇文章';
  }

  // 搜索功能
  function searchPosts(query) {
    if (!query.trim()) {
      filteredPosts = [...allPosts];
    } else {
      const searchTerm = query.toLowerCase();
      filteredPosts = allPosts.filter(post => 
        post.title.toLowerCase().includes(searchTerm) ||
        post.excerpt.toLowerCase().includes(searchTerm) ||
        (post.tags && post.tags.some(tag => tag.toLowerCase().includes(searchTerm))) ||
        (post.categories && post.categories.some(cat => cat.toLowerCase().includes(searchTerm)))
      );
    }

    renderPosts();
    updatePostsCount();
  }

  // 筛选功能
  function filterPosts(filterType) {
    currentFilter = filterType;

    switch (filterType) {
      case 'recent':
        filteredPosts = [...allPosts].sort((a, b) => 
          new Date(b.lastModified || b.date) - new Date(a.lastModified || a.date)
        ).slice(0, 10);
        break;
      case 'tags':
        filteredPosts = [...allPosts].sort((a, b) => 
          (b.tags ? b.tags.length : 0) - (a.tags ? a.tags.length : 0)
        );
        break;
      default:
        filteredPosts = [...allPosts];
    }

    renderPosts();
    updatePostsCount();
  }

  // 事件监听
  unlockBtn.addEventListener('click', verifyPassword);

  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      verifyPassword();
    }
  });

  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      searchPosts(e.target.value);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterPosts(btn.dataset.filter);
    });
  });

  // 初始化
  // 清除之前的认证状态，每次都要求重新输入密码
  sessionStorage.removeItem(config.sessionKey);
}); 