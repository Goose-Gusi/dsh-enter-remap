# dsh-enter-remap

Remap <kbd>Enter</kbd> / <kbd>Ctrl+Enter</kbd> / <kbd>Shift+Enter</kbd> in the DSH composer into any of three actions — line break, send, and busy-time send. There is no settings page: the mapping comes from three values in `cordis.patch.yml`. The plugin never sends messages, never edits your draft, and never writes to DSH's own files.

DSH 插件：把输入框的 Enter、Ctrl+Enter、Shift+Enter 重映射为换行、发送或繁忙时发送。

## 安装

从 npm：

```bash
dsh plugin add dsh-enter-remap
```

从本地目录 / 源码：

```bash
dsh plugin add ./dsh-enter-remap
```

装完重启 DSH，在「设置 → 插件」里能看到它；回到输入框按一下 Enter，变成换行就说明生效了。

## 兼容性

- 需要支持插件包（`dsh.bundle`）的 DSH 版本。只使用公开扩展点：宿主侧监听 `webserver/index-inject` 事件，客户端侧通过 `window.__ModuleLoader__.load` 注册一个 web 客户端插件。
- 不依赖任何 `@deepseek-ai/*` 运行时包，也不 import DSH 内部模块，因此不受 DSH 小版本升级影响。
- 客户端只在 DSH 输入框（Lexical 编辑器，选择器 `[data-lexical-editor="true"]`）上监听按键。如果将来 DSH 更换输入框实现，插件的按键改写会失效、行为回到原生，但不会报错，也不会损坏会话。
- 在 DSH desktop（Windows）上验证过；macOS / Linux 未逐平台测试，原理上等价。

## 工作原理

DSH 原生已经有这三种动作：Enter 发送（忙时按「设置 → 通用 → Composer Enter」决定 queue/steer），Ctrl+Enter 发送（互补投递），Shift+Enter 换行。本插件只在页面捕获阶段改写按键，把它换成目标动作对应的原生组合键，再交给 DSH 自己的 keymap 执行。插件不发送消息、不改草稿、不改任何 DSH 设置。

## 配置

配置在 `cordis.patch.yml` 的 `config` 里：

```yaml
config:
  enter: newline      # Enter
  ctrlEnter: send     # Ctrl+Enter
  shiftEnter: busySend # Shift+Enter
```

可选值：

| 值 | 行为 |
| --- | --- |
| `newline` | 换行（沿用原生 Shift+Enter） |
| `send` | 发送行为（沿用原生 Enter；忙时执行「通用 → 繁忙时的发送行为」选中的排队/插话） |
| `busySend` | 繁忙时的发送行为（沿用原生 Ctrl+Enter；忙时执行另一条投递方式） |

默认配置是一次三键轮换：Enter 换行，Ctrl+Enter 发送（忙时按通用设置），Shift+Enter 发送（忙时用另一种投递）。空闲时两个发送键都会把消息发到会话，差别只体现在繁忙时的排队/插话方式。

两个"发送"语义不同，配置时注意：`send` 走**非加速** Enter（模型忙时按「繁忙时的发送行为」设置决定 queue/steer）；`busySend` 走**加速** Ctrl+Enter（模型忙时总是执行与设置相反的那一种）。想让某个键"忙时固定排队"或"忙时固定插话"，用 Ctrl+Enter 侧的那个值配合设置一起调。

改完配置后重启 DSH 生效。页面上没有设置入口，重装或升级插件不会覆盖你的配置。

## 边界情况

- `/`、`@` 之类的补全菜单打开时，Enter 原样交给菜单仲裁（选中高亮项；没高亮项时仍会发送），不会被改写成换行。
- `Alt` / `AltGr`（含 Windows 上的 `Ctrl+Alt`）、`Ctrl+Meta+Enter`、`Shift+Ctrl/Meta+Enter` 保持 DSH 原生行为（原生会吞掉或直接放行），不参与重映射。
- 输入法合成中（`isComposing` / keyCode 229）以及合成结束后的 10ms 窗口内（与 DSH 原生 `recentlyComposing` 一致）不做改写，交给浏览器与 DSH 原生处理，避免中文确认回车多出换行。
- 长按产生的自动重复会原样透传给 DSH，发送类按键因此只触发一次（与原生键一致）。
- 配置在每次按键时读取，所以运行期直接改 `window.__DSH_ENTER_REMAP__` 立即生效；但改 `cordis.patch.yml` 仍需重启 DSH。

## 卸载

```bash
dsh plugin remove dsh-enter-remap
```

重启 DSH 后输入框恢复原生键位。插件不写用户数据、不改 DSH 设置，配置只存在于插件自己的 `cordis.patch.yml` 里，卸载后不留残留。

## 开发说明

本插件在 AI 辅助下编写，功能设计、边界情况的判断与测试由作者负责并持续维护。

This plugin was written with AI assistance. Its design, edge-case decisions and testing are the author's responsibility, and it is maintained by the author.

## License

[MIT](LICENSE)
