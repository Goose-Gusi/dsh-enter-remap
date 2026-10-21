# dsh-enter-remap

Remap <kbd>Enter</kbd> / <kbd>Ctrl+Enter</kbd> / <kbd>Shift+Enter</kbd> in the DSH composer into any of three actions — line break, send, and busy-time send. No settings page, no config files touched; it only rewrites the pressed key during the capture phase and hands it back to DSH's own keymap.

DSH 插件：把输入框的 Enter、Ctrl+Enter、Shift+Enter 重映射为换行、发送或繁忙时发送。

## 安装

从 npm（发布后）：

```bash
dsh plugin add dsh-enter-remap
```

从本地目录 / 源码：

```bash
dsh plugin add ./dsh-enter-remap
```

装完重启 DSH，然后在「设置 → 插件」里能看到它。

## 工作原理

DSH 原生已经有这三种动作：Enter 发送（忙时按「设置 → 通用 → Composer Enter」决定 queue/steer），Ctrl+Enter 发送（互补投递），Shift+Enter 换行。本插件只在页面捕获阶段改写按键，把它换成目标动作对应的原生组合键，再交给 DSH 自己的 keymap 执行。插件不发送消息、不改草稿、不改任何 DSH 文件或设置。

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

## License

[MIT](LICENSE)
