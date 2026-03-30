const { app, BrowserWindow } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

const devUrl = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      /* file:// + 本地 React 桌面端，关闭 sandbox 避免部分环境白屏；仍保持 contextIsolation */
      sandbox: false,
    },
    title: "作曲",
  });
  win.once("ready-to-show", () => win.show());

  win.webContents.on("context-menu", (event) => {
    event.preventDefault();
  });

  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexHtml = path.join(__dirname, "../dist/index.html");
    win.loadURL(pathToFileURL(indexHtml).href);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
