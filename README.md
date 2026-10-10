# 科任教師獎勵簿

供一位科任教師管理多個任教班級。每班都有獨立的學生名單、累積分數、任務檢核與操作紀錄，資料存於全新的私人 Google 試算表，不會連接原本的導師班級獎勵系統。

## 已完成的功能

- 教師密碼登入與30天記住裝置
- 任教班級首頁，可隨時新增班級
- 每班1～50人，預設30人
- 只顯示座號，或在有名單時顯示姓名
- Excel（`.xlsx`）、CSV、TSV名單匯入及匯入前預覽
- 個人及全班快捷加扣分
- 每班獨立的任務檢核與多輪入帳
- 每日、本週與學期累積統計
- 每班操作紀錄、撤銷與CSV匯出
- 新學期複製班級與名單、選擇是否複製任務，全部分數歸零
- 舊學期唯讀保留
- 班級封存與恢復

## 資料架構

- 網站：教師操作畫面，不含學生資料或密碼。
- Google Apps Script：驗證密碼並處理所有讀寫。
- 私人 Google 試算表：保存操作日誌、班級總分及讀取快照。

每筆資料都包含學期及班級代碼，因此新增班級不需要修改程式，也不需要新增另一份網站。

## 本機預覽與檢查

```bash
npm install
npm run check
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

開啟 `http://127.0.0.1:5173/?preview` 可使用五個示範班級測試，不會連接真實資料。

## 連接 Google 試算表

1. 建立一份全新的私人 Google 試算表。
2. 建立綁定該試算表的 Apps Script 專案。
3. 將 `apps-script/Code.gs`、`apps-script/Model.gs` 貼入 Apps Script。
4. 在 Apps Script「指令碼屬性」加入：
   - `SPREADSHEET_ID`：新試算表的ID。
   - `PASSWORD_VERIFIER`：執行 `node scripts/password-verifier.mjs` 後取得的值。
5. 在 Apps Script 編輯器執行一次 `initialize_()`，建立「班級總分」、「操作紀錄」及「移轉資料」工作表。
6. 將 Apps Script 部署為網頁應用程式，執行身分選擇擁有者，存取者依實際帳號設定。
7. 將部署後的 `/exec` 網址填入 `public/config.json` 的 `appsScriptUrl`。
8. 重新建置並發布網站。

`public/config.json` 只能放公開的 Apps Script 網頁應用程式網址；不得放入試算表ID、密碼或學生資料。
