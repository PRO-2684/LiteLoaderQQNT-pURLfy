<img src="./icons/icon.svg" align="right" style="width: 6em; height: 6em;"></img>

# pURLfy

> 🧹 pURLfy, 取自 "purify" 和 "URL" 的结合，意为净化 URL 链接，可发音为 `pjuɑrelfaɪ`。

[LiteLoaderQQNT](https://github.com/mo-jinran/LiteLoaderQQNT) 插件，用于净化 QQNT 中的 URL 链接。此插件灵感来源于 [Tarnhelm](https://tarnhelm.project.ac.cn/)。

## 🪄 具体功能

- 自动净化将要在浏览器打开的 URL 链接 (`shell.openExternal`)
- 临时禁用：在插件设置中可以临时禁用插件的净化功能，以便在需要时打开原始链接
- 统计数据：净化的链接数量、净化的参数数量、解码的网址数量、净化的字符数量
    - \* 仅在程序正常退出时才会保存数据

## 🖼️ 截图

![settings](./attachments/settings.jpg)

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

打开插件后自动生效。

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

```json
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
    "author": "<作者>"
}
```

- `<模式>`: 规则使用的模式，`white` 为 [白名单](#白名单模式)，`black` 为 [黑名单](#黑名单模式)，~~`regex` 为 [正则表达式](#正则表达式)，~~`param` 为 [取特定参数](#取特定参数)
- `<param n>`: 参数名
- `<decode_func n>`: 取特定参数模式下用到的解码函数，按序调用。详见 [取特定参数](#取特定参数)。

### 白名单模式

白名单模式下，只有在 `params` 中指定的参数才会被保留，原网址中的其余参数会被删除。通常来说这是最常用的模式。

### 黑名单模式

黑名单模式下，在 `params` 中指定的参数将会被删除，原网址中的其余参数会被保留。

### 正则表达式

暂未实现。

### 取特定参数

取特定参数模式下，pURLfy 会依次尝试取出 `params` 中指定的参数，直到匹配到第一个存在的参数；随后使用 `decode` 数组中指定的解码函数依次对参数值进行解码，并将其作为新的 URL **再次执行净化**。若 `decode` 值无效，则不做处理。目前支持如下值:

- `url`: 解码 URL 编码 (`decodeURIComponent`)
- `base64`: 解码 Base64 编码 (`atob`)

值得注意的事项：

- 再次执行净化时所使用的规则亦会计入统计数据，因此一个网址可能会被多次计算
- `净化 - 匹配` 中显示的规则为首条使用的规则。例如 `rule a` 是 "取特定参数" 规则，它得到的 URL 结果再次匹配了 `rule b`，则 `净化 - 匹配` 中显示的规则为 `rule a`

## ❤️ 贡献

欢迎提交 PR 或 Issue，来改进此插件以及完善相应的 [规则文件](./rules.json)！

若您想要调试此插件本身或 `rules.json`，可以使用 `--purlfy-debug` 参数激活 Debug 模式，此时插件会在控制台输出调试信息。

## 🤔 pURLfy CORE

若您想将 pURLfy 的净化功能移植到其他地方，可以复制 `main.js` 中由 `// === pURLfy CORE start ===` 和 `// === pURLfy CORE end ===` 包裹的代码段，然后移除末尾与统计数据相关的代码即可。有几点需要注意：

- 需要预先定义好 `rules` 变量。
- 需要预先定义好 `log` 函数。
- 记得遵守开源协议。

## 🎉 鸣谢

- 感谢 [Tarnhelm](https://tarnhelm.project.ac.cn/) 提供的规则文件，为 pURLfy 提供了很多灵感
- 感谢 GreasyFork 上的 [这个脚本](https://greasyfork.org/scripts/412612)，为 pURLfy 提供了一些规则
