# 隱私權政策 — Claude 用量喵喵 (Claude Usage Nyan)

最後更新日期：2026 年 3 月 19 日

## 概述

「Claude 用量喵喵」是一個 Chrome 瀏覽器擴充功能，用於追蹤您在 claude.ai 上的使用量。我們尊重您的隱私，本政策說明我們如何處理您的資料。

## 資料收集

本擴充功能**不會收集、傳輸或儲存任何個人資料到外部伺服器**。

所有資料僅儲存在您的瀏覽器本機（chrome.storage.local），包括：
- 您的 Claude 使用量百分比（從 claude.ai 取得）
- 對話的 token 估算數據
- 預估費用計算結果

## 資料使用

- 本擴充功能使用您在 claude.ai 的登入 session（cookie）來存取 Anthropic 的用量 API
- Cookie 僅用於向 claude.ai 發送請求，絕不會傳送到任何第三方伺服器
- 所有 API 請求僅對 claude.ai 域名發送

## 第三方服務

本擴充功能**不使用**任何第三方服務，包括但不限於：
- 無 Google Analytics 或任何分析工具
- 無 Firebase 或任何雲端資料庫
- 無廣告網路
- 無追蹤工具

## 權限說明

- **cookies**：讀取 claude.ai 的 session cookie 以存取用量 API
- **storage**：在本機儲存用量資料
- **alarms**：定期更新用量資料（每 5 分鐘）
- **host_permissions (claude.ai)**：存取 claude.ai 的 API 端點

## 資料刪除

移除本擴充功能將自動刪除所有本機儲存的資料。您也可以在擴充功能內點擊「重置計數」來手動清除 token 追蹤資料。

## 開源

本擴充功能的完整原始碼公開於 GitHub，歡迎檢視：
https://github.com/anthropic-paul/claude-usage-nyan

## 聯絡方式

如有任何隱私相關問題，請透過 GitHub Issues 聯繫。

## 變更

本政策如有更新，將在 GitHub 上公告。
