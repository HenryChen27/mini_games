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

合集源码位于 `games/mini-kitchen/`，游戏 id 为 `mini-kitchen`，版本 1.5.2。合集打包器生成 `BonbonKitchen-game.zip`，包内入口为 `game/index.html`，顶层 `package.json` 提供 id、runtime、version 元数据。

## 宿主接入

`engine.js` 不依赖 DOM；`game.js` 负责界面、存档与输入。浏览器接口为 `window.BonbonKitchen`，版本 1.5.2；素材均为相对 URL，宿主需允许 HTTP 资源加载与 localStorage。

- `saveAll()` / `save()`：同步保存当前回合、特效、已提交的快捷键、音量和成绩。返回 `{ok, savedRun, savedAt}`；失败返回 `{ok:false,error}`，不会把内存备份当作持久化成功。
- `await prepareToClose()`：先保存并回读验证，再冻结计时、特效、输入、自动化和音频。仅在成功后返回 `{ok:true,readyToClose:true,...}`。失败返回 `readyToClose:false`，宿主应保留窗口并展示错误；重复调用可安全等待同一关闭任务。
- `await resume()`：宿主取消关闭时调用。营业中的回合经过 321 倒计时继续；首页和结算页保持原场景。自动化不会自动重新启用。
- `getSession()`：挂起时返回 `hostSuspended:true, phase:'suspended', running:false, paused:true`。
- 原有 `start()`、`getState()`、`performAction(action)` 和 `bonbon:start`、`bonbon:order-complete`、`bonbon:finish` 事件继续可用。挂起期间拒绝游戏操作。

```js
const result = await window.BonbonKitchen.prepareToClose();
if (result.ok && result.readyToClose) {
  // 此时由宿主关闭 WebView。
} else {
  // 显示 result.error，保留窗口供重试或恢复。
}
// 若用户取消关闭：await window.BonbonKitchen.resume();
```

页面卸载和隐藏时也会尝试同步保存，但这些事件无法向宿主确认结果，安全关闭仍应等待上述握手。重开 WebView 后点击开始，可选择继续已保存回合。`python scripts/lifecycle_check.py` 检查存储失败、重复关闭、冻结、倒计时恢复和重载存档。
