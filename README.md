<img src="./icons/icon.svg" align="right" style="height: 6em;"></img>

# pURLfy

[![GitHub License](https://img.shields.io/github/license/PRO-2684/QQNT-pURLfy?logo=gnu)](https://github.com/PRO-2684/QQNT-pURLfy/blob/main/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/PRO-2684/QQNT-pURLfy/release.yml?branch=main&logo=githubactions)](https://github.com/PRO-2684/QQNT-pURLfy/blob/main/.github/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/PRO-2684/QQNT-pURLfy?logo=githubactions)](https://github.com/PRO-2684/QQNT-pURLfy/releases)
[![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/PRO-2684/QQNT-pURLfy/total?logo=github)](https://github.com/PRO-2684/QQNT-pURLfy/releases)
[![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/PRO-2684/QQNT-pURLfy/latest/total?logo=github)](https://github.com/PRO-2684/QQNT-pURLfy/releases/latest)

> [!WARNING]
> 由于 [LiteLoaderQQNT](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT) 没有良好的 ESM 支持，此插件将暂停支持此框架。若您仍需在 LiteLoaderQQNT 下使用，请使用 [`v0.3.8`](https://github.com/PRO-2684/QQNT-pURLfy/releases/tag/v0.3.8) 及之前的旧版本。若您有良好的编程基础，亦可尝试自行修改 LiteLoaderQQNT 框架后使用。

> 🧹 pURLfy, 取自 "purify" 和 "URL" 的结合，意为净化 URL 链接，可发音为 `pjuɑrelfaɪ`。

QwQNT 插件，用于净化 QQNT 中的 URL 链接。此插件灵感来源于 [Tarnhelm](https://tarnhelm.project.ac.cn/)。

## 🪄 具体功能

- 手动净化：在插件设置界面中输入链接并回车即可手动净化链接
- 自动净化
    - 自动净化将要在浏览器打开的 URL 链接 (hook `shell.openExternal`)
    - 自动净化发送的**文本消息**中的 URL 链接 (高度实验性，疑似不可用，若想启用请参照 [使用方法](#-使用方法))
- 迭代式净化：支持净化多层嵌套的链接，例如外链中的链接
- 规则热更新：支持在插件设置中更新规则文件
- 启用/禁用规则：在插件设置中可以启用/禁用规则 (各规则说明详见 [pURLfy rules](https://github.com/PRO-2684/pURLfy-rules))
- 临时禁用：在插件设置中可以临时禁用插件的净化功能，以便在需要时打开原始链接
- 统计数据：净化的链接数量、净化的参数数量、解码的网址数量、净化的字符数量
    - \* 仅在程序正常退出时才会保存数据

## 🖼️ 截图

![settings](./attachments/settings.jpg)

![log](./attachments/log.jpg)

## 📥 安装

- 稳定版: 下载 Release 中的 `purlfy-release.zip`，解压后放入数据目录下的 `plugins/purlfy` 文件夹中即可。(若没有该文件夹请自行创建)
- CI 版: 若想体验最新的 CI 功能，可以下载下面列出的文件后同上安装。其中 `purlfy.js` 以及规则文件 `rules/` 未包含在此仓库内，您可以从 [pURLfy core](https://github.com/PRO-2684/pURLfy/blob/main/purlfy.js) 和 [pURLfy rules](https://github.com/PRO-2684/pURLfy-rules/) 获取。

完成后的目录结构应该如下:

```
plugins (所有的插件目录)
└── purlfy (此插件目录)
    ├── manifest.json (插件元数据)
    ├── purlfy.js (插件核心)
    ├── main.js (插件脚本)
    ├── preload.js (插件脚本)
    ├── renderer.js (插件脚本)
    ├── settings.html (插件设置界面)
    ├── icons/ (插件用到的图标)
    └── rules/ (净化规则)
```

## 🤔 使用方法

打开插件后自动生效。若想手动净化链接，可以在设置界面输入链接后回车。若想启用测试中的“净化发送的文本消息” (当前疑似不可用)，请修改 `config.json` 中 `hooks.sendMessage` 为  `true`。以下是一些测试链接：

- BiliBili 短链: `https://b23.tv/SI6OEcv` (短链已过期)
- 中规中矩的贴吧分享链接: `https://tieba.baidu.com/p/7989575070?share=none&fr=none&see_lz=none&share_from=none&sfc=none&client_type=none&client_version=none&st=none&is_video=none&unique=none`
- MC 百科外链: `https://link.mcmod.cn/target/aHR0cHM6Ly9naXRodWIuY29tL3dheTJtdWNobm9pc2UvQmV0dGVyQWR2YW5jZW1lbnRz`
- 必应的搜索结果: `https://www.bing.com/ck/a?!&&p=de70ef254652193fJmltdHM9MTcxMjYyMDgwMCZpZ3VpZD0wMzhlNjdlMy1mN2I2LTZmMDktMGE3YS03M2JlZjZhMzZlOGMmaW5zaWQ9NTA2Nw&ptn=3&ver=2&hsh=3&fclid=038e67e3-f7b6-6f09-0a7a-73bef6a36e8c&psq=anti&u=a1aHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8_bGlua2lkPTg2ODkyMg&ntb=1`
- 套娃 N 次后甚至无法正常访问的外链: `https://www.minecraftforum.net/linkout?remoteUrl=https%3A%2F%2Fwww.urlshare.cn%2Fumirror_url_check%3Furl%3Dhttps%253A%252F%252Fc.pc.qq.com%252Fmiddlem.html%253Fpfurl%253Dhttps%25253A%25252F%25252Fgithub.com%25252Fjiashuaizhang%25252Frpc-encrypt%25253Futm_source%25253Dtest`

## ❤️ 贡献

欢迎提交 PR 或 Issue 来改进此插件。此插件基于 [pURLfy core](https://github.com/PRO-2684/pURLfy)，它是 pURLfy 的核心部分，独立为一个 JavaScript 库，用于净化 URL 链接。若此插件无法正常工作，请在此仓库中提交 Issue 或 PR；若净化链接有问题，请在 [pURLfy core](https://github.com/PRO-2684/pURLfy) 仓库中提交 Issue 或 PR；若想要完善净化规则，请在 [pURLfy rules](https://github.com/PRO-2684/pURLfy-rules) 仓库中提交 Issue 或 PR。

若您想要调试此插件或规则文件，可以使用 `--purlfy-debug` 参数激活 Debug 模式，使用 `--enable-logging` 启用控制台输出，此时插件会在控制台输出调试信息。

## 🎉 鸣谢

- 感谢 [Tarnhelm](https://tarnhelm.project.ac.cn/) 提供的规则文件，为 pURLfy 提供了很多灵感
- 感谢 GreasyFork 上的 [这个脚本](https://greasyfork.org/scripts/412612)，为 pURLfy 提供了一些规则

## ⭐ Star History

[![Stargazers over time](https://starchart.cc/PRO-2684/QQNT-pURLfy.svg?variant=adaptive)](https://starchart.cc/PRO-2684/QQNT-pURLfy)
