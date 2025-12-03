const { app, BrowserWindow } = require("electron/main");
const path = require("path");
const { spawn } = require("child_process");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let nextProcess = null;

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
    // Production: Load từ static export
    // Khi packaged, dist có thể ở trong app.asar hoặc Resources folder
    const fs = require("fs");
    let indexPath;

    if (app.isPackaged) {
      // Khi packaged với asarUnpack, dist sẽ ở app.asar.unpacked/dist
      const appPath = app.getAppPath();

      // Thử các path có thể:
      // 1. app.asar.unpacked/dist (nếu asarUnpack)
      const unpackedPath = path.join(
        appPath,
        "..",
        "app.asar.unpacked",
        "dist",
        "index.html"
      );
      // 2. app.asar/dist (nếu trong asar)
      const asarPath = path.join(appPath, "dist", "index.html");
      // 3. Resources/dist (nếu extraResources)
      const resourcesPath =
        process.resourcesPath ||
        path.join(path.dirname(process.execPath), "..", "Resources");
      const resourcesIndexPath = path.join(resourcesPath, "dist", "index.html");

      // Kiểm tra file nào tồn tại
      if (fs.existsSync(unpackedPath)) {
        indexPath = unpackedPath;
      } else if (fs.existsSync(asarPath)) {
        indexPath = asarPath;
      } else if (fs.existsSync(resourcesIndexPath)) {
        indexPath = resourcesIndexPath;
      } else {
        // Fallback: dùng asarPath
        indexPath = asarPath;
        console.warn("Cannot find dist/index.html, trying:", indexPath);
      }
    } else {
      // Development build (không packaged)
      indexPath = path.join(__dirname, "dist", "index.html");
    }

    console.log("Loading index.html from:", indexPath);
    win.loadFile(indexPath).catch((err) => {
      console.error("Failed to load index.html:", err);
    });
  }

  // Xử lý navigation cho static export
  if (!isDev) {
    // Helper function để lấy dist path
    const getDistPath = () => {
      const fs = require("fs");

      if (app.isPackaged) {
        const appPath = app.getAppPath();

        // Thử các path có thể:
        // 1. app.asar.unpacked/dist (nếu asarUnpack)
        const unpackedDistPath = path.join(
          appPath,
          "..",
          "app.asar.unpacked",
          "dist"
        );
        // 2. app.asar/dist (nếu trong asar)
        const asarDistPath = path.join(appPath, "dist");
        // 3. Resources/dist (nếu extraResources)
        const resourcesPath =
          process.resourcesPath ||
          path.join(path.dirname(process.execPath), "..", "Resources");
        const resourcesDistPath = path.join(resourcesPath, "dist");

        // Kiểm tra path nào tồn tại
        if (fs.existsSync(unpackedDistPath)) {
          return unpackedDistPath;
        } else if (fs.existsSync(asarDistPath)) {
          return asarDistPath;
        } else if (fs.existsSync(resourcesDistPath)) {
          return resourcesDistPath;
        } else {
          return asarDistPath; // Fallback
        }
      } else {
        return path.join(__dirname, "dist");
      }
    };

    const distPath = getDistPath();

    // Helper function để convert route path sang file path
    const routeToFilePath = (routePath) => {
      // Loại bỏ leading và trailing slash
      routePath = routePath.replace(/^\/+|\/+$/g, "");

      if (!routePath || routePath === "") {
        return path.join(distPath, "index.html");
      }

      // Nếu đã có .html extension, load trực tiếp
      if (routePath.endsWith(".html")) {
        return path.join(distPath, routePath);
      }

      // Thêm /index.html cho route (Next.js với trailingSlash: true)
      return path.join(distPath, routePath, "index.html");
    };

    // Intercept navigation để xử lý routing đúng cách
    win.webContents.on("will-navigate", (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);

      if (parsedUrl.protocol === "file:") {
        event.preventDefault();

        let routePath = parsedUrl.pathname;

        // Xử lý path dựa trên OS
        if (process.platform === "win32") {
          // Windows: file:///C:/path/to/dist/chat/ -> chat/
          // Loại bỏ drive letter và path đến dist
          const urlPath = routePath.replace(/^\/+/, "").replace(/\\/g, "/");
          const distPathNormalized = distPath.replace(/\\/g, "/");

          if (urlPath.includes("dist")) {
            routePath = urlPath.substring(urlPath.indexOf("dist") + 5);
          } else if (urlPath.includes(distPathNormalized)) {
            routePath = urlPath.substring(
              urlPath.indexOf(distPathNormalized) + distPathNormalized.length
            );
          } else {
            // Nếu không có dist trong path, thử parse từ absolute path
            const parts = urlPath.split("/");
            const distIndex = parts.indexOf("dist");
            if (distIndex !== -1 && distIndex < parts.length - 1) {
              routePath = parts.slice(distIndex + 1).join("/");
            }
          }
        } else {
          // Unix/Mac: file:///path/to/dist/chat/ -> chat/
          if (routePath.includes(distPath)) {
            routePath = routePath.substring(
              routePath.indexOf(distPath) + distPath.length
            );
          }
          // Loại bỏ leading slash
          routePath = routePath.replace(/^\/+/, "");
        }

        const htmlPath = routeToFilePath(routePath);

        // Load file
        win.loadFile(htmlPath).catch((err) => {
          console.error("Failed to load file:", htmlPath, err);
          // Fallback về index.html nếu route không tồn tại
          win.loadFile(path.join(distPath, "index.html"));
        });
      }
    });

    // Xử lý failed load (404) - fallback về index.html
    win.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        if (errorCode === -6) {
          // ERR_FILE_NOT_FOUND - thử load index.html
          console.log("File not found:", validatedURL);
          win.loadFile(path.join(distPath, "index.html"));
        }
      }
    );
  }
};

app.whenReady().then(() => {
  // Khởi động Next.js dev server nếu cần
  if (isDev) {
    startNextDev();
    // Đợi một chút để server khởi động
    setTimeout(() => {
      createWindow();
    }, 3000);
  } else {
    createWindow();
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

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Dừng Next.js dev server khi app đóng
  if (nextProcess) {
    nextProcess.kill();
  }
});
