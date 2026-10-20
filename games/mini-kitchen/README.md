# 邦邦小厨房

90 秒做饭小游戏，使用本地图片、字体、音效与 WebP 特效图集。前 60 秒正常烹饪，最后 30 秒进入邦邦时刻，食材立即成熟且不再烧坏。订单持续 30 秒，优先向最早需要该菜的订单上菜；空碗盘可长期储存。

## 运行

需要 Python 3。在此目录执行 `npm start`，或 `python -m http.server 8080 --bind 127.0.0.1`，打开 http://127.0.0.1:8080/。请通过 HTTP 运行，直接双击 HTML 无法加载素材清单。

右上角 F1 是图文指南；左下角设置可调整音乐、音效及桌面快捷键。退出会保存当前进度，下次开始时可继续，并显示 321 倒计时。成绩、最高分和快捷键保存在本机浏览器；不上传玩家数据。

## 开发与验证

`npm test` 检查规则、存档迁移、自动化调度和自由落体运动。启动本地服务器后，可运行 `python scripts/settings_shortcuts_check.py` 与 `python scripts/cinematics_check.py`；浏览器检查需要 Python Playwright。

开发版右下角保留三种自动化：普通水平、贪心备菜、理论最快。普通模式反应 650～1100ms，同按钮间隔至少 320ms；贪心模式反应 180～340ms，同按钮间隔至少 150ms。不同按钮可并行，同一目标的依赖操作保持顺序。最快模式不加人为延迟，仍走正常游戏规则。正式下载包移除自动化脚本与入口。

## 资源与打包

`assets/` 只保留当前加载的 173 个运行资产。原 PSD、参考视频、预览图、旧版生成素材及未使用音效已从工作目录清理；删除前的备份仅在原开发目录的 `.local-backup/unused-assets-before-cleanup.zip`，不提交、不发布。`scripts/clean_assets.py` 可审计资产依赖。

部分历史素材生成或比对脚本需要原始 PSD、MOV 或参考视频，应先从本地备份恢复输入；运行游戏与规则测试不依赖这些原始文件。现有素材由项目提供，此次发布不更改其权属。

合集源码位于 `games/mini-kitchen/`，游戏 id 为 `mini-kitchen`，版本 1.5.1。合集打包器生成 `BonbonKitchen-game.zip`，包内入口为 `game/index.html`，顶层 `package.json` 提供 id、runtime、version 元数据。

## 宿主接入

`engine.js` 不依赖 DOM；`game.js` 负责界面、存档与输入。浏览器接口为 `window.BonbonKitchen`：`start()`、`getState()`、`getSession()`、`performAction(action)`；事件有 `bonbon:start`、`bonbon:order-complete`、`bonbon:finish`。素材均为相对 URL，可在插件的本地 WebView 中运行，需允许资源加载与 localStorage。当前没有通用宿主的关闭握手接口；宿主应调用游戏内退出保存流程后再关闭页面。
