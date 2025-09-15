/**
 * 智能图片加载器
 * 按照指定策略加载图片：
 * 1. 首先加载页面其他区域的图片（topimg、头像、推荐文章封面等）
 * 2. 等待加载动画结束
 * 3. 启动滚动检测，只在停止滚动600ms后加载可视区域的文章图片
 */

class SmartImageLoader {
  constructor() {
    this.isScrolling = false
    this.scrollTimeout = null
    this.maxConcurrentRequests = 2
    this.currentRequests = 0
    this.requestDelay = 1000 // 1秒间隔
    this.scrollStopDelay = 600 // 滚动停止600ms后开始加载

    this.init()
  }

  init() {
    console.log('🚀 Smart Image Loader 启动')

    // 等待页面基本加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.startLoadingSequence()
      })
    } else {
      this.startLoadingSequence()
    }
  }

  async startLoadingSequence() {
    // 第一步：加载非文章内容的图片
    await this.loadNonPostImages()

    // 第二步：等待加载动画结束
    this.waitForLoadingComplete()

    // 第三步：启动文章图片的滚动检测
    this.setupScrollHandler()

    // 初始扫描一次可视区域
    setTimeout(() => {
      this.loadVisiblePostImages()
    }, 500)
  }

  async loadNonPostImages() {
    console.log('📸 开始加载非文章内容图片...')

    // 查找所有非文章内容的图片
    const nonPostImages = document.querySelectorAll(`
      .page-header img,
      .avatar img,
      .aside img,
      .related-posts img,
      .footer img,
      #sidebar img,
      .widget img,
      img:not(.post-img-deferred)
    `)

    console.log(`📊 发现 ${nonPostImages.length} 个非文章内容图片`)

    // 这些图片应该已经正常加载，我们只需要等待它们完成
    const loadPromises = Array.from(nonPostImages).map(img => {
      return new Promise((resolve) => {
        if (img.complete || !img.src) {
          resolve()
        } else {
          img.onload = () => resolve()
          img.onerror = () => resolve()
          // 5秒超时
          setTimeout(() => resolve(), 5000)
        }
      })
    })

    await Promise.all(loadPromises)
    console.log('✅ 非文章内容图片加载完成')
  }

  waitForLoadingComplete() {
    // 检测并等待页面加载动画结束
    const checkLoadingEnd = () => {
      const loadingElement = document.querySelector('#loading-box, .loading, .preloader')

      if (loadingElement && loadingElement.style.display !== 'none') {
        // 加载动画还在，继续等待
        setTimeout(checkLoadingEnd, 200)
      } else {
        console.log('✅ 页面加载动画已结束')
        // 额外等待一点时间确保页面稳定
        setTimeout(() => {
          console.log('🎯 开始文章图片延迟加载系统')
        }, 300)
      }
    }

    checkLoadingEnd()
  }

  setupScrollHandler() {
    const handleScroll = () => {
      this.isScrolling = true

      // 清除之前的延时
      clearTimeout(this.scrollTimeout)

      // 600ms后检查滚动是否停止
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false
        console.log('📜 滚动停止600ms，扫描可视图片')
        this.loadVisiblePostImages()
      }, this.scrollStopDelay)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // 监听目录点击
    document.addEventListener('click', (e) => {
      const tocLink = e.target.closest('.toc-link, .toc a, [href*="#"]')
      if (tocLink && tocLink.getAttribute('href')?.startsWith('#')) {
        // 目录点击后延迟更长时间扫描
        setTimeout(() => {
          if (!this.isScrolling) {
            this.loadVisiblePostImages()
          }
        }, 1000)
      }
    })
  }

  loadVisiblePostImages() {
    if (this.isScrolling) {
      console.log('🚫 正在滚动，跳过图片扫描')
      return
    }

    const deferredImages = document.querySelectorAll('.post-img-deferred[data-original-src]:not([data-loading]):not([src*="http"])')

    let visibleCount = 0
    deferredImages.forEach(img => {
      if (this.isElementVisible(img)) {
        this.loadImage(img)
        visibleCount++
      }
    })

    if (visibleCount > 0) {
      console.log(`📊 开始加载 ${visibleCount} 个可视图片`)
    } else {
      console.log('📊 当前可视区域没有待加载的图片')
    }
  }

  isElementVisible(element) {
    const rect = element.getBoundingClientRect()
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    )
  }

  async loadImage(img) {
    if (this.currentRequests >= this.maxConcurrentRequests) {
      // 如果达到并发限制，延迟执行
      setTimeout(() => this.loadImage(img), this.requestDelay)
      return
    }

    const originalSrc = img.getAttribute('data-original-src')
    if (!originalSrc) return

    // 标记为正在加载
    img.setAttribute('data-loading', 'true')
    this.currentRequests++

    console.log(`🚀 开始加载图片 (${this.currentRequests}/${this.maxConcurrentRequests}): ${originalSrc}`)

    // 延迟请求以控制并发
    setTimeout(() => {
      const tempImg = new Image()

      tempImg.onload = () => {
        // 加载成功，设置到原始元素
        img.src = originalSrc
        img.removeAttribute('data-loading')
        img.classList.remove('post-img-deferred')
        img.classList.add('post-img-loaded')

        // 添加淡入效果
        img.style.opacity = '0'
        img.style.transition = 'opacity 0.5s ease-in-out'

        setTimeout(() => {
          img.style.opacity = '1'
        }, 50)

        this.currentRequests--
        console.log(`✅ 图片加载成功: ${originalSrc}`)
      }

      tempImg.onerror = () => {
        console.error(`❌ 图片加载失败: ${originalSrc}`)
        img.removeAttribute('data-loading')
        this.currentRequests--
      }

      tempImg.src = originalSrc
    }, this.requestDelay)
  }
}

// 只在文章页面启动
if (document.body.classList.contains('post')) {
  new SmartImageLoader()
}