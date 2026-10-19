# 小游戏合集

集中维护独立小游戏，每款游戏保留自己的源码、资源、测试和版本。

| 游戏 | 源码与说明 | 游戏版本 |
| --- | --- | --- |
| 合成大水母 | [games/jellyfish](games/jellyfish) | 2.5.2 |
| 蚀骨赠礼 · 扫雷 | [games/minesweeper](games/minesweeper) | 1.0.0 |

[下载资源包](https://github.com/HenryChen27/mini_games/releases/latest) · [加页手记地图助手](https://github.com/HenryChen27/crypticNotes)

## 运行

在仓库根目录执行 `python -m http.server 8000`，打开 http://127.0.0.1:8000/，选择游戏。两款游戏均无需安装运行时依赖。扫雷也可在 `games/minesweeper` 执行 `npm start`，访问 http://127.0.0.1:5173/。

从旧目录切换到新网址后，浏览器存档是否保留取决于是否仍为同一个来源（协议、主机、端口），不要清除网站数据。宿主的游戏 id 和资源包内 `game/` 结构保持不变。

## 目录

- `games/<id>/`：各游戏完整源码、素材、说明与测试。
- `games.json`：游戏 id、版本、源码目录和资源包名称。
- `scripts/`：共享打包和发布脚本。
- `index.html`：本地网页合集入口。
- `dist/`：本地生成的发布文件，不提交 Git。

参考录像和本地宣传场景不入库、不打包。扫雷源码保留原始静态素材，下载包只带运行需要的文件。

## 检查

需要 Node.js；无须安装 npm 依赖：

```sh
npm test
```

水母的浏览器检查位于 `games/jellyfish/tests/`，需要 Python、Playwright 和 Chrome。合集资源包检查：

```sh
python scripts/check_packages.py dist/mini-games-v1.0.0
```

## 打包与发布

合集发布版本与各游戏版本独立。先在 `games.json` 更新被修改游戏的版本，再打合集包。兼容目录应含上一版的三个 `GameLauncher-*.zip`、三个 `Jellyfish-<平台>.zip` 桌面整包、`native-desktop-games.json` 和 `desktop-games.json`。

```sh
python scripts/package_release.py --version 1.0.0 --compatibility-dir /path/to/previous-release
```

生成水母与扫雷的独立 ZIP、合集 `games.json`、校验清单，以及兼容原水母宿主的两个旧清单和三个启动器。扫雷包解压后在 `game/` 执行 `npm start` 即可游玩；若嵌入宿主，请使用扫雷 README 中的 `MinesweeperGame` 保存接口。附带的旧原生启动器仍用于水母，不能当作扫雷启动器。

确认检查通过后，把发布说明写入 `dist/mini-games-v<版本>/release-notes.md`，提交推送，再运行：

```powershell
./scripts/publish_release.ps1 -Version 1.0.0
```

发布脚本先创建草稿，上传并核对全部附件后才公开。Release 只保留最新版，旧桌面整包一并附在最新版，原水母下载清单的文件名和结构保持兼容；新增多游戏宿主应使用合集 `games.json`，按游戏 id 选择包。

素材、作者与玩法说明见各游戏 README。