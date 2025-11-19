// RightMenu 鼠标右键菜单
let rmf = {};

// 显示右键菜单
rmf.showRightMenu = function(isTrue, x=0, y=0){
    let $rightMenu = $('#rightMenu');
    $rightMenu.css('top',x+'px').css('left',y+'px');

    if(isTrue){
        $rightMenu.show();
    }else{
        $rightMenu.hide();
    }
}

// 昼夜切换
rmf.switchDarkMode = function(){
    const nowMode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    if (nowMode === 'light') {
        activateDarkMode()
        saveToLocal.set('theme', 'dark', 2)
        GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.day_to_night)
    } else {
        activateLightMode()
        saveToLocal.set('theme', 'light', 2)
        GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.night_to_day)
    }
    // handle some cases
    typeof utterancesTheme === 'function' && utterancesTheme()
    typeof FB === 'object' && window.loadFBComment()
    window.DISQUS && document.getElementById('disqus_thread').children.length && setTimeout(() => window.disqusReset(), 200)
};

// 阅读模式
rmf.switchReadMode = function(){
    const $body = document.body
    const newEle = document.createElement('button')

    function clickFn () {
        // 添加退出动画
        newEle.style.animation = 'fadeOutScale 0.2s ease-in'
        setTimeout(() => {
            $body.classList.remove('read-mode')
            newEle.remove()
            newEle.removeEventListener('click', clickFn)
            document.removeEventListener('keydown', escapeHandler)
            // 显示退出提示
            GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow('已退出阅读模式', false, 2000)
        }, 200)
    }

    // 添加 ESC 键退出功能
    const escapeHandler = (e) => {
        if (e.key === 'Escape' && $body.classList.contains('read-mode')) {
            clickFn()
        }
    }

    // 平滑进入阅读模式
    $body.classList.add('read-mode')
    newEle.type = 'button'
    newEle.className = 'fas fa-sign-out-alt exit-readmode'
    newEle.title = '退出阅读模式 (ESC)'
    $body.appendChild(newEle)
    
    newEle.addEventListener('click', clickFn)
    document.addEventListener('keydown', escapeHandler)

    // 显示进入提示
    GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow('已进入阅读模式，按 ESC 或点击按钮退出', false, 3000)

    // 平滑滚动到文章内容
    const postContent = document.querySelector('#post')
    if (postContent) {
        setTimeout(() => {
            postContent.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 300)
    }
}

//复制选中文字
rmf.copySelect = function(){
    document.execCommand('Copy',false,null);
    //这里可以写点东西提示一下 已复制
}

//回到顶部
rmf.scrollToTop = function(){
    btf.scrollToDest(0, 500);
}

// 右键菜单事件
if(! (navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i))){
    window.oncontextmenu = function(event){
        $('.rightMenu-group.hide').hide();
        //如果有文字选中，则显示 文字选中相关的菜单项
        if(document.getSelection().toString()){
            $('#menu-text').show();
        }

        // console.log(event.target);
        let pageX = event.clientX + 10;
        let pageY = event.clientY;
        let rmWidth = $('#rightMenu').width();
        let rmHeight = $('#rightMenu').height();
        if(pageX + rmWidth > window.innerWidth){
            pageX -= rmWidth+10;
        }
        if(pageY + rmHeight > window.innerHeight){
            pageY -= pageY + rmHeight - window.innerHeight;
        }



        rmf.showRightMenu(true, pageY, pageX);
        return false;
    };

    window.addEventListener('click',function(){rmf.showRightMenu(false);});
    // window.addEventListener('load',function(){rmf.switchTheme(true);});
}
