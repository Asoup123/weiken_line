# LINE 點餐系統 — React + Vite + Appwrite + GitHub Pages

## 已包含
- 顧客端：商品分類、購物車、宅配/外送地址、貨到付款或轉帳、待確認訂單
- 管理端：Email 登入、管理員標籤權限、分類顯示/隱藏、商品新增/編輯/上下架、訂單狀態
- Appwrite Functions：後端重新計算商品價格、建立訂單；管理員權限檢查與管理 API
- GitHub Actions：推送 main 後部署 GitHub Pages

## 尚未包含（正式營運前必做）
- LINE LIFF 登入、LINE Messaging API 通知、顧客訂單查詢
- 運費計算、轉帳對帳、配送區域與配送時間管理
- 訂單提交防重複、速率限制/反濫用、個資告知與保留政策
- 商品圖片上傳介面（目前用圖片網址）
- 大量商品/訂單分頁、完整端對端測試、付款/退款流程

**重要：目前為可部署的第一版開發起點，尚未完成正式營運的安全與可靠性驗收。**

## 1. 建立 Appwrite 專案
1. Appwrite Cloud 新增獨立專案，取得 Project ID 與 Endpoint（依你的專案區域，不要直接照抄範例）。
2. 在專案 Platforms 加入 Web 平台，設定 `localhost` 與 `<GitHub帳號>.github.io`（請勿包含 `https://` 或路徑，依控制台欄位規則）。
3. 在 Databases 建立資料庫 ID：`shop`；建立以下 collections，ID 需完全一致。Appwrite 不同版本可能顯示 TablesDB，請按目前控制台的 Databases/Collections 介面建立。

### categories
- `name` string(80) required
- `active` boolean required default true
- `sort` integer required default 0
- Collection permissions: Read = Any；Create/Update/Delete 不授予 Any。

### products
- `name` string(150) required
- `price` integer required
- `categoryId` string(64) required
- `description` string(2000) optional
- `imageUrl` string(2000) optional
- `active` boolean required default true
- `sort` integer required default 0
- Collection permissions: Read = Any；Create/Update/Delete 不授予 Any。

### orders
- `customerName` string(60) required
- `phone` string(30) required
- `address` string(500) required
- `note` string(500) optional
- `payment` string(20) required
- `status` string(20) required
- `total` integer required
- `itemsJson` string(20000) required
- Collection permissions: **不得**授予 Any/Users 任何讀寫權限。僅 Functions 的 server SDK 透過 API key 讀寫。

資料庫/collection 請保持 server-side Functions 的 API key 有正確權限，**不要**在前端設定任何 Appwrite API key。請依 Appwrite 當前 SDK/控制台的權限模型核對。

## 2. 管理員登入
1. Appwrite Auth 啟用 Email/Password。
2. 在 Auth Users 建立店家管理員使用者。
3. 在該使用者的 Labels 加入 `shop-admin`。
4. **不要**讓顧客自行取得此 label。

## 3. 建立 Appwrite Functions
在 Appwrite Functions 建立兩個 Node.js Functions（建議 Node.js 22），分別部署：
- `create-order`：目錄 `appwrite/functions/create-order`，入口 `index.js`
- `admin-api`：目錄 `appwrite/functions/admin-api`，入口 `index.js`

可以使用 Appwrite Git repository 整合，為每個 Function 指定對應 root directory、entrypoint 與安裝步驟；或依 Appwrite CLI 的當前部署流程部署。各 Function 需要 `node-appwrite` 依賴。

Function execute access：
- `create-order`：Any（讓未登入顧客下單）
- `admin-api`：Users（要求登入；程式還會驗證 `shop-admin` label）

**必須在 Functions 的 Settings/Scopes 中授權執行階段所需的資料庫讀寫與 users.read 權限**，確保 `x-appwrite-key` 可用；不要將 key 寫入程式碼。Appwrite 執行環境自動提供 `APPWRITE_FUNCTION_API_ENDPOINT`、`APPWRITE_FUNCTION_PROJECT_ID` 等內建變數（以控制台目前版本為準）。

兩個 Functions 都設定環境變數：
```
DATABASE_ID=shop
CATEGORIES_ID=categories
PRODUCTS_ID=products
ORDERS_ID=orders
```

### 重要的執行權限
Appwrite Web SDK `functions.createExecution` 會以目前使用者 session 執行；管理員 API 會在 Function 中透過 `x-appwrite-user-id` 取得已驗證的使用者 ID，再由 Server SDK 檢查 label。**不要**將自稱管理員的 ID 放在 request body 當作權限依據。

## 4. 本機啟動
需 Node.js 20.19+ 或 22.12+。
```
npm install
cp .env.example .env
npm run dev
```
Windows PowerShell 複製環境檔：`Copy-Item .env.example .env`

在 `.env` 填入真實值：
```
VITE_APPWRITE_ENDPOINT=https://<你的區域>.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=<project id>
VITE_APPWRITE_DATABASE_ID=shop
VITE_APPWRITE_CATEGORIES_ID=categories
VITE_APPWRITE_PRODUCTS_ID=products
VITE_APPWRITE_ORDERS_ID=orders
VITE_APPWRITE_CREATE_ORDER_FUNCTION_ID=<function id>
VITE_APPWRITE_ADMIN_FUNCTION_ID=<function id>
```

本機打開 `http://localhost:5173`；後台 `http://localhost:5173/#admin`。

## 5. GitHub Pages 自動部署
1. 建立公開 Repository，例如 `line-order-system`。
2. 將本專案所有檔案（包含隱藏的 `.github` 資料夾）上傳到 repo 根目錄，branch `main`。
3. GitHub repo → Settings → Pages → Build and deployment → Source 選 `GitHub Actions`。
4. GitHub repo → Settings → Secrets and variables → Actions → **Variables**，建立以下 repository variables：
   - `VITE_APPWRITE_ENDPOINT`
   - `VITE_APPWRITE_PROJECT_ID`
   - `VITE_APPWRITE_DATABASE_ID`
   - `VITE_APPWRITE_CATEGORIES_ID`
   - `VITE_APPWRITE_PRODUCTS_ID`
   - `VITE_APPWRITE_ORDERS_ID`
   - `VITE_APPWRITE_CREATE_ORDER_FUNCTION_ID`
   - `VITE_APPWRITE_ADMIN_FUNCTION_ID`
5. GitHub → Actions → `Deploy GitHub Pages` → Run workflow，等待成功。
6. 網址為 `https://<username>.github.io/<repo>/`。
7. Appwrite Web Platform 加入 `<username>.github.io`，避免跨來源問題。

**注意：所有 `VITE_` 變數都會打包進瀏覽器，必須僅放公開 endpoint/IDs，絕不可放 Appwrite API key、LINE Channel secret、管理員密碼。**

## 6. 放進 LINE
1. 在 LINE 官方帳號管理後台建立圖文選單，選「連結」，填入 GitHub Pages 網址。
2. 第二階段再建立 LINE Login Channel + LIFF App，將 Endpoint URL 設為公開網址，並整合 LIFF SDK 與伺服器端 ID Token 驗證。
3. LINE 通知須在 Appwrite Functions 內使用 Messaging API，密鑰只能放 Function 環境變數。

## 測試順序
1. 管理員登入成功，非管理員無法呼叫 admin-api。
2. 新增分類、商品，前台能讀到商品。
3. 顧客加入購物車，送出測試訂單。
4. Appwrite orders 出現 pending 訂單，總金額與商品單價由後端計算。
5. 後台能將訂單改為 confirmed / preparing / shipped / completed。
6. GitHub Pages 公開網址在手機 LINE 內可開啟。

## 注意
- Appwrite 目前不同專案可能使用不同 Databases / TablesDB SDK 與 UI；本專案採傳統 `Databases` / Collections API，若新專案只支援 TablesDB，需同步調整 SDK 與資料表建立方式。
- 此版不會自動計算運費，顧客看到的是商品小計，運費需店家另行確認。
- 訂單個資敏感，必須在正式上線前補足隱私告知、資料保存、存取控制及防濫用措施。
