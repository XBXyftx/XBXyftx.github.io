document.addEventListener('pjax:complete', tonav);
document.addEventListener('DOMContentLoaded', tonav);
//响应pjax
function tonav() {
    var nameContainer = document.querySelector("#nav #name-container");
	var menusItems = document.querySelector("#nav .menus_items");
    var position = $(window).scrollTop();

    $(window).scroll(function() {
        var scroll = $(window).scrollTop();

        if (scroll > position + 5) {
            nameContainer.classList.add("visible");
            menusItems.classList.remove("visible");
        } else if  (scroll < position - 5){
            nameContainer.classList.remove("visible");
            menusItems.classList.add("visible");
        }

        position = scroll;
    });

    // 初始化 page-name
    document.getElementById("page-name").innerText = document.title.split(" | LiuShen's Blog")[0];
}
