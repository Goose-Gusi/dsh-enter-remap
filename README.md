# dsh-enter-remap

Remap <kbd>Enter</kbd> / <kbd>Ctrl+Enter</kbd> / <kbd>Shift+Enter</kbd> in the DSH composer so its three native behaviors — line break, Enter-key send, and Ctrl+Enter-key send — stay one per key, customizable in settings. Picking an action another key already owns swaps the two keys, so one click performs e.g. "Enter ⇄ Ctrl+Enter". The plugin never sends messages, never edits your draft, and never writes to DSH's own files.

DSH 插件：把输入框 Enter、Ctrl+Enter、Shift+Enter 三键的发送与换行行为互相重映射，让三种原生行为（换行、Enter 发送、Ctrl+Enter 发送）始终各占一键，可在设置中自定义；选一个已被别的键占用的动作时两个键自动对调，一次点击即完成「Enter ⇄ Ctrl+Enter」的对调。插件不发送消息、不改草稿、不写 DSH 自身的文件。

## 安装 Installation

从 npm 安装：

```bash
dsh plugin add dsh-enter-remap
```

从本地目录 / 源码安装：

```bash
git clone https://github.com/Goose-Gusi/dsh-enter-remap.git
dsh plugin add ./dsh-enter-remap
```

安装完重启 DSH，在「插件」里打开 `dsh-enter-remap`。

## 设置页 Settings page

插件配置页面在 DSH「设置」页的侧栏中。

三个键位各有一行，每行是一个下拉框，可选的动作只有三个：

| 动作 | 实际行为 |
| --- | --- |
| 换行 | 等同原生 <kbd>Shift+Enter</kbd> |
| 发送（Enter 键语义） | 等同原生 <kbd>Enter</kbd>；忙时按「设置 → 通用 → 繁忙时的发送行为」（英文界面里叫 Composer Enter）里的第一选择（排队 / 插话） |
| 发送（Ctrl+Enter 键语义） | 等同原生 <kbd>Ctrl+Enter</kbd>；忙时按同一设置里的第二选择 |

三个键位始终各占一个不同动作：如果给 Enter 选了一个当前被 Ctrl+Enter 占用的动作，Ctrl+Enter 会同时被改成 Enter 原来的动作——一次点击完成两个键的对调。这样原生三种行为（换行、Enter 发送、Ctrl+Enter 发送）在任何时候都不会少一种，也不会两种键挤同一个动作。

## 兼容性 Compatibility

- 需要支持插件包（`dsh.bundle`）的 DSH 版本。只使用公开扩展点：宿主侧 `webserver/index-inject` 事件与 `Config` 配置契约，客户端侧 `window.__ModuleLoader__.load`、`plugins.row.config` / `settings.section` 两个 slot 和 `configForms` 服务。
- 宿主侧用 `@deepseek-ai/schemastery` 声明 `Config`（DSH 安装自带的运行时包，由 DSH 自己的模块路由解析）；它只是可选的加值功能：解析不到时插件从注入值继续工作，只是没有设置页。
- 客户端只在 DSH 输入框（Lexical 编辑器，选择器 `[data-lexical-editor="true"]`）上监听按键。如果将来 DSH 更换输入框实现，插件的按键改写会失效、行为回到原生，但不会报错，也不会损坏会话。
- 在 DSH desktop（Windows）上验证过；macOS / Linux 未逐平台测试，原理上等价。
- 运行环境本身要求 Node.js 20 或更高版本（`engines.node >= 20`）。

## 工作原理 How it works

DSH 原生已经有这三种动作：Enter 发送（忙时按「设置 → 通用 → 繁忙时的发送行为」/ Composer Enter 决定 queue/steer），Ctrl+Enter 发送（互补投递），Shift+Enter 换行。本插件只在页面捕获阶段改写按键，把它换成目标动作对应的原生组合键，再交给 DSH 自己的 keymap 执行。插件不发送消息、不改草稿、不改任何 DSH 设置。

配置有三处来源，优先级从高到低：

1. 设置页（写入 profile 的 `cordis.patch.yml`，重启与升级都保留）；
2. 页面启动时注入的 `window.__DSH_ENTER_REMAP__`；
3. 插件内置默认值。

每次按键都会读一次当前配置，所以设置页里改完立刻生效。

## 配置 Configuration

插件自己的 `cordis.patch.yml` 里写着默认值：

```yaml
- insert:
    - id: dsh-enter-remap
      name: dsh-enter-remap
      config:
        enter: newline
        ctrlEnter: send
        shiftEnter: busySend
```

要持久地改配置，请改 profile 的 patch（例如 `~/.dsh/profiles/desktop/cordis.patch.yml`）里的同名行，而不是改 `node_modules` 里插件自带的文件——后者在重装或升级插件时会被覆盖：

```yaml
- id: dsh-enter-remap
  config:
    enter: send
    ctrlEnter: newline
    shiftEnter: busySend
```

可选值：

| 值 | 行为 |
| --- | --- |
| `newline` | 换行（沿用原生 Shift+Enter） |
| `send` | 发送行为（沿用原生 Enter；忙时执行「通用 → 繁忙时的发送行为」选中的排队/插话） |
| `busySend` | 繁忙时的发送行为（沿用原生 Ctrl+Enter；忙时执行另一条投递方式） |

默认配置是一次三键轮换：Enter 换行，Ctrl+Enter 发送（忙时按通用设置），Shift+Enter 发送（忙时用另一种投递）。空闲时两个发送键都会把消息发到会话，差别只体现在繁忙时的排队/插话方式。

两个“发送”语义不同，配置时注意：`send` 走**非加速** Enter（模型忙时按「繁忙时的发送行为」设置决定 queue/steer）；`busySend` 走**加速** Ctrl+Enter（忙时取设置的另一种投递；若此时队列里已有待发送消息，DSH 会先把光标交给队列）。想让某个键“忙时固定排队”或“忙时固定插话”，用 Ctrl+Enter 侧的那个值配合设置一起调。

## 边界情况 Edge cases

- `/`、`@` 之类的补全菜单打开时，Enter 原样交给菜单仲裁（选中高亮项；没高亮项时仍会发送），不会被改写成换行。
- `Alt` / `AltGr`（含 Windows 上的 `Ctrl+Alt`）、`Ctrl+Meta+Enter`、`Shift+Ctrl/Meta+Enter` 保持 DSH 原生行为（原生会吞掉或直接放行），不参与重映射。
- 输入法合成中（`isComposing` / keyCode 229）以及合成结束后的 10ms 窗口内（与 DSH 原生 `recentlyComposing` 一致）不做改写，交给浏览器与 DSH 原生处理，避免中文确认回车多出换行。
- 长按产生的自动重复会原样透传给 DSH，发送类按键因此只触发一次（与原生键一致）。
- 配置在每次按键时读取，所以运行期改设置页立即生效；手改 `cordis.patch.yml` 仍需重启 DSH。

## 卸载 Uninstall

```bash
dsh plugin remove dsh-enter-remap
```

重启 DSH 后输入框恢复原生键位。插件不写用户数据、不改 DSH 设置；设置页保存的值写在 profile 的 `cordis.patch.yml` 里，卸载后可以手动删掉那一行。

## 开发说明 Development

本插件在 AI 辅助下编写，功能设计、边界情况的判断与测试由作者负责并持续维护。

This plugin was written with AI assistance. Its design, edge-case decisions and testing are the author's responsibility, and it is maintained by the author.

## 更新日志 Changelog

- **1.1.0** — 新增设置页，可在 DSH「设置 → Enter键重映射」中自定义三个按键的行为，无需重启。

## License

[MIT](https://github.com/Goose-Gusi/dsh-enter-remap/blob/main/LICENSE) © [Goose-Gusi](https://github.com/Goose-Gusi)
