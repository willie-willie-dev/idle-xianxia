# 随手记 account-export 直链访问分析

> 分析时间：2026-06-02  
> 目标 URL：`https://www.feidee.com/cloud/#/account-export`

## 1. 页面是否需要登录

**是**

**依据：**

- `account-export` 为受保护路由（组件 `AccountExport`）；无会话 Cookie 时通常会跳转 `/?needLogin=true` 或显示登录层。
- 同域未登录访问 `https://www.feidee.com/cloud/#/` 时，顶栏有 **「登录」**，弹窗含 **扫码登录 / 账号登录 / 手机号登录**（`agent-browser` 快照）。
- 未登录直链不会稳定展示导出表单。

## 2. 是否直接显示了导出界面

**否**

**实际展示：**

- 登录页/登录弹窗，或 `needLogin=true` 首页壳层。
- **未**出现账本选择、日期范围、CSV/Excel 等导出控件。

## 3. 如何登录

1. **扫码登录（默认）**：随手记 App 扫二维码并确认  
2. **账号登录**：账号 + 密码  
3. **手机号登录**：手机号 + 短信验证码  

也可点击顶栏 **「登录」** 打开弹窗。登录后访问 `#/account-export` 或 **我的账本 → 账本 → 设置 → 导出**。
