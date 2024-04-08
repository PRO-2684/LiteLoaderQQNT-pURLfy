<img src="./icons/icon.svg" align="right" style="width: 6em; height: 6em;"></img>

# pURLfy

> 🧹 pURLfy, 取自 "purify" 和 "URL" 的结合，意为净化 URL 链接，可发音为 `pjuɑrelfaɪ`。

[LiteLoaderQQNT](https://github.com/mo-jinran/LiteLoaderQQNT) 插件，用于净化 QQNT 中的 URL 链接。此插件灵感来源于 [Tarnhelm](https://tarnhelm.project.ac.cn/)。

## 🪄 具体功能

- 手动净化：在插件设置界面中输入链接并回车即可手动净化链接
- 自动净化：自动净化将要在浏览器打开的 URL 链接 (hook `shell.openExternal`)
- 迭代式净化：支持净化多层嵌套的链接，例如外链中的链接
- 临时禁用：在插件设置中可以临时禁用插件的净化功能，以便在需要时打开原始链接
- 统计数据：净化的链接数量、净化的参数数量、解码的网址数量、净化的字符数量
    - \* 仅在程序正常退出时才会保存数据

## 🖼️ 截图

![settings](./attachments/settings.jpg)

![log](./attachments/log.jpg)

## 📥 安装

### 插件商店

~~在插件商店中找到 pURLfy 并安装。~~

### 手动安装

- 稳定版: 下载 Release 中的 `purlfy-release.zip`，解压后放入[数据目录](https://github.com/mo-jinran/LiteLoaderQQNT-Plugin-Template/wiki/1.%E4%BA%86%E8%A7%A3%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84#liteloader%E7%9A%84%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95)下的 `plugins/purlfy` 文件夹中即可。(若没有该文件夹请自行创建)
- CI 版: 若想体验最新的 CI 功能，可以下载源码后同上安装。(仅需下载下面列出的文件)

完成后的目录结构应该如下:

```
plugins (所有的插件目录)
└── purlfy (此插件目录)
    ├── manifest.json (插件元数据)
    ├── main.js (插件脚本)
    ├── preload.js (插件脚本)
    ├── renderer.js (插件脚本)
    ├── rules.json (净化规则)
    ├── settings.html (插件设置界面)
    └── icons/ (插件用到的图标)
```

## 🤔 使用方法

打开插件后自动生效。若想手动净化链接，可以在设置界面输入链接后回车。以下是一些测试链接：

- BiliBili 短链: `https://b23.tv/SI6OEcv`
- 套娃 N 次后甚至无法正常访问的外链: `https://www.minecraftforum.net/linkout?remoteUrl=https%3A%2F%2Fwww.urlshare.cn%2Fumirror_url_check%3Furl%3Dhttps%253A%252F%252Fc.pc.qq.com%252Fmiddlem.html%253Fpfurl%253Dhttps%25253A%25252F%25252Fgithub.com%25252Fjiashuaizhang%25252Frpc-encrypt%25253Futm_source%25253Dtest`
- 中规中矩的贴吧分享链接: `https://tieba.baidu.com/p/7989575070?share=none&fr=none&see_lz=none&share_from=none&sfc=none&client_type=none&client_version=none&st=none&is_video=none&unique=none`

## 📃 规则文件

> 部分规则来源于 [Tarnhelm](https://tarnhelm.project.ac.cn/rules.html)。

规则文件 [`rules.json`](./rules.json) 的格式如下:

```jsonc
{
    "<domain>": {
        "<path>": {
            // 一条具体的规则
            "description": "<规则描述>",
            "mode": "<模式>",
            "params": ["<param 1>", "<param 2>", ...],
            "decode": ["<decode_func 1>", "<decode_func 2>"],
            "lambda": "<lambda>",
            "continue": Boolean,
            "author": "<作者>"
        }
    }
}
```

- `<domain>`, `<path>`: 域名和路径，匹配规则见 [路径匹配](#路径匹配)
- 具体规则的字段见 [规则](#规则)

### 路径匹配

`<domain>`, `<path>`: 域名和路径，例如 `example.com/`, `path/to/page` (去除开头的 `/`)

- 若为 `""`，则表示作为 **FallBack** 规则：当此层级没有匹配到其他规则时使用此规则
- 若不以 `/` 结尾，表示其值就是一个 [规则](#规则)
- 若以 `/` 结尾，表示其下有更多子路径 (理论上可以无限嵌套)
- 当有多个规则匹配时，会使用 **最长匹配** 的规则
- 行为可以与 Unix 文件系统路径类比

一个简单的例子，规则描述内给出了可以匹配的网址:

```jsonc
{
    "example.com/": {
        "a/b/c": {
            // 这里的规则会匹配 "example.com/a/b/c"
        },
        "path/": {
            "to/": {
                "page": {
                    // 这里的规则会匹配 "example.com/path/to/page"
                },
                "": {
                    // 这里的规则会匹配 "example.com/path/to" 除 "page" 以外的所有子路径
                }
            }
        },
        "": {
            // 这里的规则会匹配 "example.com" 除 "path" 以外的所有子路径
        }
    },
    "example.org": {
        // 这里的规则会匹配 "example.org" 的所有路径
    },
    "": {
        // Fallback: 所有未匹配到的路径都会使用这里的规则
    }
}
```

以下是***错误示范***:

```jsonc
{
    "example.com/": {
        "path/to/page/": { // 以 `/` 结尾的会被认为下面有子路径，正确写法是把 `path/to/page/` 改为 `path/to/page`
            // 尝试匹配 "example.com/path/to/page" 的规则
        }
    },
    "example.org": { // 不以 `/` 结尾的会被认为是一条规则，正确写法是把 `example.org` 改为 `example.org/`
        "path/to/page": {
            // 尝试匹配 "example.org/path/to/page" 的规则
        }
    }
}
```

### 规则

不以 `/` 结尾的路径的值就是一条规则。规则有多种模式，具体定义如下:

```jsonc
{
    "description": "<规则描述>",
    "mode": "<模式>",
    "params": ["<param 1>", "<param 2>", ...], // 仅在 `white`/`black` / `param` 模式下有效
    "decode": ["<decode_func 1>", "<decode_func 2>"], // 仅在 `param` 模式下有效
    "lambda": "<lambda>", // 仅在 `lambda` 模式下有效
    "continue": Boolean, // 仅在 `param`, `redirect`, `lambda` 模式下有效
    "author": "<作者>"
}
```

- `<模式>`: 规则使用的模式，可以是:
    - `white`: [白名单](#白名单模式)
    - `black`: [黑名单](#黑名单模式)
    - ~~`regex`: [正则表达式](#正则表达式)~~ (暂未实现)
    - `param`: [取特定参数](#取特定参数)
    - `redirect`: [重定向](#重定向)
    - `lambda`: [匿名函数](#匿名函数)
- `<param n>`: 参数名
- `<decode_func n>`: 取特定参数模式下用到的解码函数，按序调用。详见 [取特定参数](#取特定参数)。
- `<lambda>`: 匿名函数，详见 [匿名函数](#匿名函数)
- `<continue>`: 在 `param`, `redirect`, `lambda` 模式下，控制当前规则生效后的新网址是否应该再次被净化，默认为 `true`

### 白名单模式

白名单模式下，只有在 `params` 中指定的参数才会被保留，原网址中的其余参数会被删除。通常来说这是最常用的模式。

### 黑名单模式

黑名单模式下，在 `params` 中指定的参数将会被删除，原网址中的其余参数会被保留。

### 正则表达式

暂未实现。

### 取特定参数

取特定参数模式下，pURLfy 会依次尝试取出 `params` 中指定的参数，直到匹配到第一个存在的参数；随后使用 `decode` 数组中指定的解码函数依次对参数值进行解码，将最终的结果作为新的 URL。若 `decode` 值无效，则跳过这个解码函数。若 `continue` 未被设置为 `false`，则将再次净化新的 URL。目前支持如下值:

- `url`: 解码 URL 编码 (`decodeURIComponent`)
- `base64`: 解码 Base64 编码 (`atob`)

值得注意的事项：`净化 - 匹配` 中显示的规则为首条使用的规则。例如 `rule a` 是 "取特定参数" 规则，它得到的 URL 结果再次匹配了 `rule b`，则 `净化 - 匹配` 中显示的规则为 `rule a`。

### 重定向

重定向模式下，pURLfy 会向匹配到的网址发起 HEAD 请求，若返回的状态码为 3xx，则会将重定向后的网址作为新的 URL。若 `continue` 未被设置为 `false`，则将再次净化新的 URL。

### 匿名函数

> [!CAUTION]
> 出于安全考虑，此特性默认关闭。若您想要使用此特性，请在插件设置中开启 `允许匿名函数`。

匿名函数模式下，pURLfy 会尝试执行 `lambda` 字段中指定的函数体。传入参数为 `url`，和返回值一样均为 `URL` 对象。例如如下规则：

```json
{
    "example.com": {
        "description": "示例",
        "mode": "lambda",
        "lambda": "url.searchParams.delete('key'); return url;",
        "continue": false,
        "author": "PRO-2684"
    },
}
```

那么如果 `https://example.com/?key=123` 匹配到了此规则，则会删除 URL 中的 `key` 参数。在此操作后，因为 `continue` 被设置为 `false`，函数返回的 URL 不会被再次执行净化。当然，这并非一个很好的例子，因为这完全可以通过黑名单模式实现，但是可以展示匿名函数的基本用法。

## ❤️ 贡献

欢迎提交 PR 或 Issue，来改进此插件以及完善相应的 [规则文件](./rules.json)！

若您想要调试此插件本身或 `rules.json`，可以使用 `--purlfy-debug` 参数激活 Debug 模式，此时插件会在控制台输出调试信息。

## 🤔 pURLfy CORE

若您想将 pURLfy 的净化功能移植到其他地方，可以复制 `main.js` 中由 `// === pURLfy CORE start ===` 和 `// === pURLfy CORE end ===` 包裹的代码段。有几点需要注意：

- 移除/修改与统计数据相关的代码。
- 需要预先定义好 `rules` 变量，用于存放规则。(可从 `rules.json` 中读取)
- 需要预先定义好 `lambdaEnabled` 变量，用于控制是否允许匿名函数。
- 需要预先定义好 `log` 函数，用于输出日志。
- 记得遵守开源协议。

## 🎉 鸣谢

- 感谢 [Tarnhelm](https://tarnhelm.project.ac.cn/) 提供的规则文件，为 pURLfy 提供了很多灵感
- 感谢 GreasyFork 上的 [这个脚本](https://greasyfork.org/scripts/412612)，为 pURLfy 提供了一些规则
