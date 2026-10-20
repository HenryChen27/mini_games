/* Illustrated rules. All recipe pictures are crops of the supplied PSD art. */
(function(){
 const host=document.querySelector('#visual-rules');
 const im=(id,alt)=>`<img src="assets/guide/${id}.webp" alt="${alt}" draggable="false">`;
 const arrow='<span class="guide-arrow" aria-hidden="true">→</span>';
 const row=(items)=>`<div class="guide-flow">${items.join(arrow)}</div>`;
 host.innerHTML=`<header class="guide-heading"><h2>邦邦小厨房</h2><p>90 秒一局 · 最后 30 秒进入邦邦时刻</p></header>
 <div class="guide-grid">
 <section class="guide-card"><h3>① 看订单，上菜</h3><div class="guide-order-demo">${im(94,'订单便签')}<div>${im(23,'玉米汤')}${im(59,'煎牛肉')}<img class="guide-correct" src="assets/correct.png" alt="已上菜"></div></div><p>每张订单保留 <b>30 秒</b>。点击做好的菜，自动交给<b>最早需要它的订单</b>；一张订单全部完成后加分。</p></section>
 <section class="guide-card"><h3>② 水壶煮汤</h3>${row([im(85,'水壶'),im(2,'空汤锅'),`<span class="guide-step">${im(21,'清汤')}<small>加热 3 秒</small></span>`])}<p>点击水壶，自动倒入空锅。煮沸后可直接上清汤，也可点击配料变成：</p><div class="guide-recipes">${row([im(72,'玉米配料'),im(23,'玉米汤')])}${row([im(73,'胡萝卜配料'),im(22,'胡萝卜汤')])}</div></section>
 <section class="guide-card"><h3>③ 平底锅煎肉</h3>${row([im(79,'生牛肉'),im(35,'空平底锅'),`<span class="guide-step">${im(59,'煎牛肉')}<small>加热 3 秒</small></span>`])}<p>点击生牛肉，自动放入空平底锅。煎熟后可直接上菜，或加入配料：</p><div class="guide-recipes">${row([im(70,'番茄配料'),im(57,'番茄牛肉')])}${row([im(71,'土豆配料'),im(58,'土豆牛肉')])}</div></section>
 <section class="guide-card"><h3>④ 空碗空盘，提前备菜</h3><div class="guide-recipes">${row([im(3,'锅内清汤'),im(20,'空碗'),im(21,'碗中清汤')])}${row([im(36,'锅内牛肉'),im(56,'空盘'),im(59,'盘中牛肉')])}</div><p>没有对应订单时，点击锅内成品，会移入空碗或空盘。碗盘中的菜<b>可以一直保存</b>；没有空位则留在锅里。</p><p>点击存货时，若订单不需要它，会直接丢弃。</p></section>
 <section class="guide-card"><h3>⑤ 留意进度，及时清理</h3><div class="guide-trash">${im(40,'烧糊的牛肉')}${arrow}${im(90,'垃圾桶')}<div class="guide-bars"><i></i><i></i><i></i></div></div><p>普通阶段，成品继续留锅 <b>18 秒</b>会烧坏。点击坏菜清理；垃圾桶本身不用点击。</p><p>订单：绿 → 黄 → 红。锅内保鲜倒计时：黄 → 红。<b>最后 5 秒</b>总计时变红，注意抓紧上菜。</p></section>
 <section class="guide-card"><h3>⑥ 邦邦时刻</h3><div class="guide-bonbon"><img src="assets/bell.png" alt="邦邦时刻铃铛"><p>剩余 <b>30 秒</b>时摇铃、蒸汽扩散。食材<b>放入即熟</b>，新做的菜不再烧坏，进度条保持绿色。</p></div><div class="guide-awards"><span>2000 · 铜牌厨师</span><span>5000 · 银牌厨师</span><span>8000 · 金牌厨师</span></div></section>
 </div><footer class="guide-footer">左下角设置可调音乐、音效；电脑还可查看和修改快捷键。<br>左上角退出会保存本局，下次开始可继续。</footer>`;
})();
