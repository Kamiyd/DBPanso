# 豆瓣盘搜（DBPanso）

一个开源的 Chromium 浏览器扩展。它可以读取豆瓣影片详情页的标题，搜索 Telegram 公开频道中的相关网盘链接，并在浏览器侧边栏展示结果。

> 本项目仅供学习和技术研究。请遵守目标站点的服务条款、版权要求及所在地法律法规，请勿用于传播未经授权的内容或谋利。

## 当前功能

- 在豆瓣影片详情页读取主片名和年份，并在标题位置加入快捷搜索按钮
- 在可用时提供「主片名 + 年份」和「完整片名」搜索选项
- 从扩展弹窗手动输入关键词，或在侧边栏中搜索其他影片
- 并发搜索已启用的 Telegram 公开频道，并显示频道搜索进度
- 识别常见网盘分享链接、磁力链接、电驴链接和部分提取码
- 根据标准化后的链接合并跨频道重复结果
- 按网盘类型筛选，按时间或相关度排序
- 从标题和正文识别 4K、HDR、REMUX、Blu-ray、Atmos 等标签，点击标签可继续筛选
- 侧边栏空闲时尝试读取豆瓣热门影片，点击片名即可搜索
- 对部分候选网盘链接检测页面响应状态
- 管理频道：添加、启停、删除、批量操作、连接检测、停用失效项和恢复默认
- 设置 2–20 的频道搜索并发数
- 开启或关闭扩展交互音效

## 安装

扩展需要支持 `chrome.sidePanel` 的 Chromium 浏览器，建议使用 Chrome 114+ 或较新版本的 Edge。

1. 从 [Releases](https://github.com/Cole404/DBPanso/releases/latest) 下载名称为 `DBPanso-v*-chrome.zip` 的安装包。
2. 解压 ZIP，保留解压后的扩展目录。
3. 打开 `chrome://extensions/`；Edge 用户打开 `edge://extensions/`。
4. 开启「开发者模式」。
5. 点击「加载已解压的扩展程序」。
6. 选择解压后包含 `manifest.json` 的目录。

GitHub 自动附带的 `Source code (zip)` 是源码快照，不是精简后的 Chrome 安装包。

如需直接加载源码，也可以下载或克隆本仓库，然后按以下方式加载：

1. 下载并解压本项目。
2. 打开 `chrome://extensions/`；Edge 用户打开 `edge://extensions/`。
3. 开启「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择包含 `manifest.json` 的项目根目录。

## 使用

1. 确保当前网络可以访问 `t.me`。扩展使用浏览器的网络环境和系统代理。
2. 打开豆瓣影片详情页。
3. 点击标题附近的片名搜索按钮；需要时可选择带年份或完整片名的搜索词。
4. 在右侧侧边栏查看、筛选和排序结果。
5. 点击结果中的网盘链接直接打开目标页面。

扩展弹窗和侧边栏都可以手动发起搜索。频道设置入口位于扩展弹窗和侧边栏右上角。

## 搜索与数据

1. 扩展对每个已启用频道请求 `https://t.me/s/<channel>?q=<keyword>`。
2. 在扩展内解析 Telegram 公开预览页，提取消息标题、时间、标签和链接。
3. 在本地完成关键词过滤、链接分类、提取码识别、去重和排序。

扩展不使用 Telegram Bot API，也不需要本项目的自建搜索服务。频道配置、并发数、排序和音效偏好等设置保存在 `chrome.storage.local` 中。

## 链接状态说明

扩展只会选取部分候选网盘链接，通过 HTTP 响应检测其页面当时是否可访问。「可达」不等于网盘内的资源一定未过期；需要登录、遇到限流或无法确定时，会显示「需验证」、「暂不可用」或「无法判断」。磁力和电驴链接不进行页面状态检测。

## 频道来源

打开频道设置页时，扩展会读取 [PanSou Issue #4](https://github.com/fish2018/pansou/issues/4) 正文中维护的 Telegram 频道清单。本地缓存在 6 小时内有效，也可在设置页手动点击「更新」。

同步会向本地列表追加新频道，不会删除已有频道或覆盖用户设置的启停状态。

## 与 PanSou 的关系

本扩展的功能和技术设计参考了 [PanSou](https://github.com/fish2018/pansou) 的公开源码，包括 Telegram 公开频道搜索、预览页解析、网盘链接识别和结果去重等思路。

当前扩展不调用 PanSou 的 `/api/search`，也不依赖它的 Go 服务、缓存层或聚合插件。搜索请求由扩展直接发往 Telegram。与 PanSou 相关的运行时请求只有通过 GitHub API 读取上述 Issue 频道清单。

感谢 PanSou 及其贡献者的开源工作。

## 开源依赖与致谢

- [PanSou](https://github.com/fish2018/pansou) — 功能和技术设计的参考项目，MIT License
- [Cuelume](https://github.com/Danilaa1/cuelume) v0.2.2 — 扩展交互音效，MIT License；许可证位于 `vendor/cuelume/LICENSE`

## 开发

当前源码无需构建，可直接作为未打包扩展加载。生成不包含本地预览、调试历史和开发权限的生产安装包：

```bash
npm run package
```

输出位于 `dist/DBPanso-v<version>/` 和 `dist/DBPanso-v<version>-chrome.zip`。发布工作流会在推送 `v*` 标签时自动生成 Release 安装包和 SHA-256 校验文件。

## 限制

- 只能读取 Telegram 公开频道的网页预览内容。
- Telegram 的频道搜索页只返回有限数量的结果。
- 频道过多或并发过高可能触发 `t.me` 的 HTTP 429 限流。
- 豆瓣热门列表、Telegram 搜索和链接状态都依赖相应站点当时可访问。
- 扩展需要访问豆瓣、Telegram、GitHub API 和已支持的网盘域名，具体权限以 `manifest.json` 为准。

## License

本项目以 [MIT License](LICENSE) 开源。第三方代码保留各自的版权和许可声明，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
