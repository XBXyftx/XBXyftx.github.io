/**
 * [TocToggleGroup] 目录 hideToggle 折叠项联动
 *
 * 配合 scripts/toc-toggle-group.js 生成的目录折叠分组：
 * 1. 点击目录链接时，若目标标题位于折叠的 hideToggle 内容块内，
 *    先展开该内容块（捕获阶段执行，先于 main.js 的滚动定位），
 *    修复“点击目录跳转看不到折叠内容”的问题。
 * 2. 滚动高亮落入折叠目录组时，自动展开该目录组并标记 has-active。
 * 3. 带 hash 进入页面且目标在折叠块内时，展开并修正滚动位置。
 *
 * 仅在文章页加载；幂等，兼容 PJAX 重初始化。
 */

(function () {
  'use strict'

  let observer = null

  const getTocRoot = () => document.querySelector('#aside-content #card-toc .toc-content')

  // 展开元素所有未展开的 details 祖先（hideToggle 内容块）
  const openAncestorDetails = el => {
    let node = el.parentElement
    while (node) {
      if (node.tagName === 'DETAILS' && !node.open) node.open = true
      node = node.parentElement
    }
  }

  const decodeHash = href => {
    const raw = href.slice(1)
    try {
      return decodeURIComponent(raw)
    } catch (e) {
      return raw
    }
  }

  // 捕获阶段先于 main.js 的目录点击处理展开内容折叠块
  const onTocClickCapture = e => {
    if (!e.target || !e.target.closest) return
    const link = e.target.closest('#card-toc .toc-link')
    if (!link) return
    const href = link.getAttribute('href') || ''
    if (href.charAt(0) !== '#') return
    const target = document.getElementById(decodeHash(href))
    if (target) openAncestorDetails(target)
  }

  // 滚动高亮联动：当前激活目录链接处于折叠目录组时自动展开
  const syncActiveGroup = () => {
    const root = getTocRoot()
    if (!root) return
    root.querySelectorAll('.toc-toggle-item').forEach(item => {
      const hasActive = !!item.querySelector('.toc-link.active')
      item.classList.toggle('has-active', hasActive)
      const details = item.querySelector(':scope > .toc-toggle')
      if (hasActive && details && !details.open) details.open = true
    })
  }

  const bindObserver = () => {
    if (observer) observer.disconnect()
    const root = getTocRoot()
    if (!root) {
      observer = null
      return
    }
    observer = new MutationObserver(syncActiveGroup)
    observer.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true })
  }

  // 带 hash 进入页面：目标在折叠内容块内时展开并修正位置
  const openHashTarget = () => {
    if (!location.hash) return
    const target = document.getElementById(decodeHash(location.hash))
    if (!target) return
    if (!target.closest('details.toggle:not([open])')) return
    openAncestorDetails(target)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const top = target.getBoundingClientRect().top + window.scrollY - 90
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' })
  }

  const init = () => {
    bindObserver()
    openHashTarget()
  }

  // 点击监听挂在 document 捕获阶段，注册一次即可，PJAX 切换后仍有效
  if (!window.__tocToggleGroupBound) {
    window.__tocToggleGroupBound = true
    document.addEventListener('click', onTocClickCapture, true)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  document.addEventListener('pjax:complete', init)
})()
