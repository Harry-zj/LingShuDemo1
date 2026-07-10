# 双主题使用说明

本版本保留原有深色主题，并新增偏米白、低饱和度的清新主题。

## 使用方式

- 页面右上角新增“深色 / 米白”切换按钮。
- 首页、功能页和登录页均可切换。
- 选择会保存在浏览器 `localStorage` 中，刷新或再次打开网页时保持上次主题。
- 原深色主题仍为首次访问时的默认主题。

## 主要新增文件

- `client/src/components/ThemeToggle.vue`
- `client/src/assets/styles/theme.css`

## 调整米白主题

在 `theme.css` 的 `html[data-theme='light']` 区域修改颜色变量即可。核心色为：

- 页面背景：`#f5f0e7`
- 卡片背景：`#fffaf2`
- 主色（鼠尾草绿）：`#667b6d`
- 正文：`#30352f`
- 次要文字：`#686c65`

## 运行

进入 `client` 目录后执行：

```bash
npm install
npm run dev
```
