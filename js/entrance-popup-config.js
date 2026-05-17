// 入场弹窗配置文件
// 您可以在这里自定义弹窗的内容和行为

window.EntrancePopupConfig = {
  // 弹窗文本数组 - 可以根据您的需要修改
  texts: [
    '欢迎来到我的博客！希望您在这里找到有价值的内容～',
    '感谢您的访问！记得收藏本站以便下次再来哦～',
    '这里有很多有趣的技术文章，快去探索吧！',
    '博客更新中，敬请期待更多精彩内容！',
    '愿您在这里度过愉快的阅读时光！',
    '技术改变生活，代码创造未来！',
    '每一次学习都是成长的开始！',
    '在这里，我们一起分享知识与经验！',
    '保持好奇心，持续学习，不断进步！',
    '代码如诗，逻辑如画，享受编程的乐趣！',
    '感谢您的到来，让我们一起学习成长！',
    '鸿蒙生态星河璀璨，一起探索未来！',
    '每一行代码都是创造力的体现！',
    '学习路上，与君同行！',
    // 可以在这里添加更多文本
  ],

  // 弹窗显示配置
  settings: {
    autoCloseTime: 3000,     // 自动关闭时间（毫秒）
    showOnEveryPage: true,   // 是否在每个页面都显示
    animationDelay: 500,     // 页面加载后延迟显示时间（毫秒）
    enableEscapeClose: true, // 是否允许按ESC键关闭
    enableOverlayClose: false, // 不启用遮罩层点击关闭，避免干扰
    title: 'XBXyftx：',       // 弹窗标题
  },

  // 特定页面配置（可选）
  pageSpecific: {
    // 首页特定文本
    home: [
      '欢迎来到XBXyftx的博客！',
      '这里记录着我的学习成长之路～',
      '鸿蒙开发、技术分享，与您共同进步！'
    ],
    // 文章页面特定文本
    post: [
      '感谢您阅读我的文章！',
      '希望这篇文章对您有所帮助～',
      '欢迎在评论区留下您的想法！'
    ],
    // 归档页面特定文本
    archive: [
      '这里汇集了我的所有文章～',
      '时间见证成长，文字记录足迹！',
      '找找看有没有您感兴趣的内容吧！'
    ]
  },

  // 节日/特殊日期配置（可选）
  seasonal: {
    // 春节
    'spring-festival': {
      dates: ['02-01', '02-15'], // 大概时间范围
      texts: [
        '新春快乐！祝您在新的一年里技术更进一步！',
        '恭贺新禧！愿您的代码bug越来越少！',
        '龙年大吉！祝您学习工作顺利！'
      ]
    },
    // 程序员节
    'programmer-day': {
      dates: ['10-24'],
      texts: [
        '程序员节快乐！致敬每一位辛勤的代码工作者！',
        '今天是程序员的节日，为自己点个赞吧！',
        'Debug不易，且行且珍惜！程序员节快乐！'
      ]
    }
  }
};

// 获取当前页面类型
function getCurrentPageType() {
  if (window.location.pathname === '/') return 'home';
  if (window.location.pathname.includes('/posts/') || window.location.pathname.includes('/archives/')) return 'post';
  if (window.location.pathname.includes('/archives')) return 'archive';
  return 'default';
}

// 获取当前日期字符串 (MM-DD格式)
function getCurrentDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

// 获取适合当前页面的文本数组
function getTextsForCurrentPage() {
  const config = window.EntrancePopupConfig;
  const currentDate = getCurrentDateString();
  
  // 检查是否是特殊日期
  for (const [key, seasonal] of Object.entries(config.seasonal)) {
    if (seasonal.dates.includes(currentDate)) {
      return seasonal.texts;
    }
  }
  
  // 根据页面类型返回特定文本
  const pageType = getCurrentPageType();
  if (config.pageSpecific[pageType]) {
    return config.pageSpecific[pageType];
  }
  
  // 返回默认文本
  return config.texts;
}

// 导出配置到全局
window.getEntrancePopupTexts = getTextsForCurrentPage;
window.getEntrancePopupSettings = function() {
  return window.EntrancePopupConfig.settings;
}; 