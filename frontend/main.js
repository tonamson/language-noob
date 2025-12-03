const { app, BrowserWindow } = require("electron/main");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let nextProcess = null;
let staticServer = null;
let staticServerPort = 3456; // Port cho static server trong production

// MIME types cho static files
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain",
};

// Lấy dist path
const getDistPath = () => {
  if (app.isPackaged) {
    const appPath = app.getAppPath();
    const unpackedDistPath = path.join(
      appPath,
      "..",
      "app.asar.unpacked",
      "dist"
    );
    const asarDistPath = path.join(appPath, "dist");
    const resourcesPath =
      process.resourcesPath ||
      path.join(path.dirname(process.execPath), "..", "Resources");
    const resourcesDistPath = path.join(resourcesPath, "dist");

    if (fs.existsSync(unpackedDistPath)) {
      return unpackedDistPath;
    } else if (fs.existsSync(asarDistPath)) {
      return asarDistPath;
    } else if (fs.existsSync(resourcesDistPath)) {
      return resourcesDistPath;
    }
    return asarDistPath;
  }
  return path.join(__dirname, "dist");
};

// Khởi động static HTTP server cho production
const startStaticServer = () => {
  return new Promise((resolve, reject) => {
    const distPath = getDistPath();
    console.log("Static server serving from:", distPath);

    staticServer = http.createServer((req, res) => {
      let urlPath = req.url.split("?")[0]; // Loại bỏ query string

      // Xử lý routing - nếu không có extension, thử load HTML file
      let filePath;
      if (urlPath === "/" || urlPath === "") {
        filePath = path.join(distPath, "index.html");
      } else if (path.extname(urlPath) === "") {
        // Không có extension -> thử load .html file hoặc folder/index.html
        const htmlPath = path.join(distPath, urlPath + ".html");
        const indexPath = path.join(distPath, urlPath, "index.html");

        if (fs.existsSync(htmlPath)) {
          filePath = htmlPath;
        } else if (fs.existsSync(indexPath)) {
          filePath = indexPath;
        } else {
          filePath = path.join(distPath, urlPath);
        }
      } else {
        filePath = path.join(distPath, urlPath);
      }

      // Kiểm tra file tồn tại
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // Fallback về index.html cho SPA routing
          const indexPath = path.join(distPath, "index.html");
          fs.readFile(indexPath, (err2, data) => {
            if (err2) {
              res.writeHead(404);
              res.end("Not Found");
              return;
            }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(data);
          });
          return;
        }

        // Đọc và serve file
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end("Server Error");
            return;
          }
          res.writeHead(200, { "Content-Type": mimeType });
          res.end(data);
        });
      });
    });

    staticServer.listen(staticServerPort, "127.0.0.1", () => {
      console.log(
        `Static server running at http://127.0.0.1:${staticServerPort}`
      );
      resolve(staticServerPort);
    });

    staticServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        // Port đang được sử dụng, thử port khác
        staticServerPort++;
        staticServer.listen(staticServerPort, "127.0.0.1");
      } else {
        reject(err);
      }
    });
  });
};

// Khởi động Next.js dev server nếu ở development mode
const startNextDev = () => {
  if (isDev) {
    nextProcess = spawn("npm", ["run", "dev"], {
      cwd: __dirname,
      shell: true,
      stdio: "inherit",
    });

    nextProcess.on("error", (err) => {
      console.error("Failed to start Next.js dev server:", err);
    });
  }
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Load URL dựa trên môi trường
  if (isDev) {
    // Development: Load từ Next.js dev server
    win.loadURL("http://localhost:3000");

    // Mở DevTools trong development
    win.webContents.openDevTools();
  } else {
    // Production: Load từ local HTTP server
    // Static server đã được khởi động trước khi tạo window
    const serverUrl = `http://127.0.0.1:${staticServerPort}`;
    console.log("Loading from static server:", serverUrl);
    win.loadURL(serverUrl);
  }
};

app.whenReady().then(async () => {
  // Khởi động server tương ứng với môi trường
  if (isDev) {
    // Development: Khởi động Next.js dev server
    startNextDev();
    // Đợi một chút để server khởi động
    setTimeout(() => {
      createWindow();
    }, 3000);
  } else {
    // Production: Khởi động static HTTP server
    try {
      await startStaticServer();
      createWindow();
    } catch (err) {
      console.error("Failed to start static server:", err);
      app.quit();
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Dừng Next.js dev server nếu đang chạy
  if (nextProcess) {
    nextProcess.kill();
  }

  // Dừng static server nếu đang chạy
  if (staticServer) {
    staticServer.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Dừng Next.js dev server khi app đóng
  if (nextProcess) {
    nextProcess.kill();
  }

  // Dừng static server khi app đóng
  if (staticServer) {
    staticServer.close();
  }
});
