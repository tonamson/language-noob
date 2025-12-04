const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  nativeImage,
  desktopCapturer,
} = require("electron/main");
const path = require("path");
const { spawn, fork } = require("child_process");
const http = require("http");
const fs = require("fs");
const { execSync } = require("child_process");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let nextProcess = null;
let apiProcess = null;
let staticServer = null;
let staticServerPort = 3456; // Port cho static server trong production
let mainWindow = null; // Reference đến main window

// Lấy đường dẫn đến config.json (có thể chỉnh sửa sau khi build)
const getConfigPath = () => {
  if (app.isPackaged) {
    // Production: Tìm config.json ở các vị trí có thể chỉnh sửa được
    // 1. Thư mục Resources (extraResources)
    const resourcesPath = process.resourcesPath;
    const resourcesConfigPath = path.join(resourcesPath, "config.json");
    if (fs.existsSync(resourcesConfigPath)) {
      return resourcesConfigPath;
    }

    // 2. Thư mục app.asar.unpacked
    const appPath = app.getAppPath();
    const unpackedConfigPath = path.join(
      appPath,
      "..",
      "app.asar.unpacked",
      "config.json"
    );
    if (fs.existsSync(unpackedConfigPath)) {
      return unpackedConfigPath;
    }

    // 3. Cùng thư mục với executable (user có thể chỉnh sửa ở đây)
    const execDir = path.dirname(process.execPath);
    const execConfigPath = path.join(execDir, "config.json");
    if (fs.existsSync(execConfigPath)) {
      return execConfigPath;
    }

    // Fallback về resources
    return resourcesConfigPath;
  }

  // Development: Trong thư mục frontend
  return path.join(__dirname, "config.json");
};

// Đọc API_LINK từ config hoặc environment variable
const getApiLink = () => {
  // Ưu tiên environment variable (dùng khi build cross-platform)
  if (process.env.API_LINK) {
    console.log("Using API_LINK from environment:", process.env.API_LINK);
    return process.env.API_LINK;
  }

  // Đọc từ config.json (có thể chỉnh sửa sau khi build)
  const configPath = getConfigPath();
  console.log("Looking for config.json at:", configPath);

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.apiLink) {
        console.log("Using API_LINK from config.json:", config.apiLink);
        return config.apiLink;
      }
    } catch (err) {
      console.warn("Failed to read config.json:", err.message);
    }
  } else {
    console.log("config.json not found, using default API link");
  }

  // Mặc định: localhost với port mặc định (2053 - port của API build)
  const defaultApiLink = "http://127.0.0.1:2053";
  console.log("Using default API_LINK:", defaultApiLink);
  return defaultApiLink;
};

const API_LINK = getApiLink();

// Lấy port từ API_LINK
const getApiPort = (apiLink) => {
  try {
    const url = new URL(apiLink);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return url.port || "2053";
    }
  } catch (err) {
    console.warn("Failed to parse API_LINK for port:", err.message);
  }
  return "2053"; // Default port
};

const isLocalApi =
  API_LINK.startsWith("http://127.0.0.1") ||
  API_LINK.startsWith("http://localhost");
const API_PORT = getApiPort(API_LINK); // Parse port từ API_LINK

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

// Lấy API path
const getApiPath = () => {
  if (app.isPackaged) {
    // Production: API được bundle vào extraResources
    const resourcesPath = process.resourcesPath;
    const resourcesApiPath = path.join(resourcesPath, "api");

    console.log("Looking for API at:", resourcesApiPath);

    if (fs.existsSync(resourcesApiPath)) {
      return resourcesApiPath;
    }

    // Fallback: thử các path khác
    const appPath = app.getAppPath();
    const unpackedApiPath = path.join(
      appPath,
      "..",
      "app.asar.unpacked",
      "api"
    );

    if (fs.existsSync(unpackedApiPath)) {
      return unpackedApiPath;
    }

    console.warn("API path not found, using default:", resourcesApiPath);
    return resourcesApiPath;
  }
  // Development: API ở thư mục song song
  return path.join(__dirname, "..", "api");
};

// Kiểm tra API server đã sẵn sàng chưa
const waitForApi = (apiUrl, maxAttempts = 30, interval = 500) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const checkApi = () => {
      attempts++;

      const req = http.get(apiUrl, (res) => {
        resolve(true);
      });

      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(
            new Error(`API server không phản hồi sau ${maxAttempts} lần thử`)
          );
        } else {
          setTimeout(checkApi, interval);
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error(`API server timeout sau ${maxAttempts} lần thử`));
        } else {
          setTimeout(checkApi, interval);
        }
      });
    };

    checkApi();
  });
};

// Kill process trên port cụ thể
const killProcessOnPort = (port) => {
  try {
    // macOS/Linux: sử dụng lsof để tìm process
    if (process.platform === "darwin" || process.platform === "linux") {
      const result = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
      if (result) {
        const pids = result.split("\n").filter((pid) => pid);
        pids.forEach((pid) => {
          try {
            console.log(`Killing process ${pid} on port ${port}...`);
            process.kill(parseInt(pid), "SIGKILL");
          } catch (e) {
            console.warn(`Failed to kill process ${pid}:`, e.message);
          }
        });
        // Đợi một chút để process được kill
        return new Promise((resolve) => setTimeout(resolve, 500));
      }
    } else if (process.platform === "win32") {
      // Windows: sử dụng netstat và taskkill
      try {
        const result = execSync(`netstat -ano | findstr :${port}`, {
          encoding: "utf-8",
        });
        const lines = result
          .split("\n")
          .filter((line) => line.includes("LISTENING"));
        lines.forEach((line) => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid) {
            try {
              console.log(`Killing process ${pid} on port ${port}...`);
              execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
            } catch (e) {
              console.warn(`Failed to kill process ${pid}:`, e.message);
            }
          }
        });
        return new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        // Không có process nào trên port này
        return Promise.resolve();
      }
    }
    return Promise.resolve();
  } catch (error) {
    // Không có process nào trên port này hoặc lỗi
    return Promise.resolve();
  }
};

// Khởi động API server
const startApiServer = () => {
  return new Promise(async (resolve, reject) => {
    // Kill process cũ trên port API trước
    const apiPort = getApiPort(API_LINK);
    console.log(`Checking for existing processes on port ${apiPort}...`);
    await killProcessOnPort(apiPort);

    const apiPath = getApiPath();
    const apiMainFile = path.join(apiPath, "dist", "main.js");

    console.log("Starting API server from:", apiMainFile);

    // Kiểm tra file tồn tại
    if (!fs.existsSync(apiMainFile)) {
      console.error("API main.js not found at:", apiMainFile);
      reject(new Error(`API file không tồn tại: ${apiMainFile}`));
      return;
    }

    // Spawn Node process để chạy API
    // API sẽ tự động đọc PORT từ environment variable hoặc dùng default
    const env = {
      ...process.env,
      NODE_ENV: "production",
    };

    // Chỉ set PORT nếu là localhost (API local)
    if (isLocalApi) {
      env.PORT = apiPort;
    }

    apiProcess = fork(apiMainFile, [], {
      cwd: apiPath,
      env,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      detached: false, // Đảm bảo process con sẽ bị kill cùng với parent
    });

    // Lưu PID để có thể kill sau này
    const apiPid = apiProcess.pid;
    console.log(`API server started with PID: ${apiPid}`);

    apiProcess.stdout.on("data", (data) => {
      console.log(`[API] ${data.toString().trim()}`);
    });

    apiProcess.stderr.on("data", (data) => {
      console.error(`[API Error] ${data.toString().trim()}`);
    });

    apiProcess.on("error", (err) => {
      console.error("Failed to start API server:", err);
      reject(err);
    });

    apiProcess.on("exit", (code, signal) => {
      console.log(`API server exited with code ${code}, signal ${signal}`);
      apiProcess = null;
    });

    // Đợi API server sẵn sàng
    console.log(`Waiting for API server at ${API_LINK}...`);
    waitForApi(API_LINK)
      .then(() => {
        console.log(`✅ API server is ready at ${API_LINK}`);
        resolve(API_LINK);
      })
      .catch(reject);
  });
};

// Khởi động API server trong development mode
const startApiDev = () => {
  return new Promise((resolve, reject) => {
    const apiPath = path.join(__dirname, "..", "api");

    console.log("Starting API dev server from:", apiPath);

    apiProcess = spawn("npm", ["run", "dev"], {
      cwd: apiPath,
      shell: true,
      stdio: "inherit",
      detached: false, // Đảm bảo process con sẽ bị kill cùng với parent
    });

    const apiPid = apiProcess.pid;
    console.log(`API dev server started with PID: ${apiPid}`);

    apiProcess.on("error", (err) => {
      console.error("Failed to start API dev server:", err);
      reject(err);
    });

    apiProcess.on("exit", (code, signal) => {
      console.log(`API dev server exited with code ${code}, signal ${signal}`);
      apiProcess = null;
    });

    // Đợi API server sẵn sàng
    setTimeout(() => {
      waitForApi(API_LINK)
        .then(() => {
          console.log(`✅ API dev server is ready at ${API_LINK}`);
          resolve(API_LINK);
        })
        .catch(reject);
    }, 2000);
  });
};

const createWindow = () => {
  // Set environment variable cho preload script
  process.env.API_URL = API_LINK;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // Preload script để inject API URL vào window
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Lưu reference đến main window
  mainWindow = win;

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
    console.log("API URL configured:", API_LINK);
    win.loadURL(serverUrl);
  }
};

// IPC Handlers cho screen capture
ipcMain.handle("get-displays", async () => {
  const displays = screen.getAllDisplays();
  return displays.map((display, index) => ({
    id: display.id,
    index: index + 1,
    bounds: display.bounds,
    size: display.size,
    scaleFactor: display.scaleFactor,
    label: `Màn hình ${index + 1} (${display.size.width}x${
      display.size.height
    })`,
  }));
});

// Screen capture variables (đơn giản - chụp toàn bộ màn hình)
let screenCaptureInterval = null;
let screenCaptureDisplayId = null;

// Helper function để chụp toàn bộ màn hình
const captureFullScreen = async (displayId) => {
  try {
    const displays = screen.getAllDisplays();
    const targetDisplay =
      displays.find((d) => d.id === displayId) || displays[0];

    // Sử dụng desktopCapturer để capture screen
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: targetDisplay.size.width,
        height: targetDisplay.size.height,
      },
    });

    // Tìm source tương ứng với display đã chọn
    const source =
      sources.find(
        (s) =>
          s.display_id === targetDisplay.id.toString() ||
          s.display_id === targetDisplay.id ||
          parseInt(s.display_id) === targetDisplay.id
      ) || sources[0];

    if (!source) {
      throw new Error("Screen source not found");
    }

    // Lấy thumbnail (đã là hình ảnh toàn màn hình)
    const imageData = source.thumbnail.toDataURL();

    return { success: true, imageData, displayId };
  } catch (error) {
    console.error("Error capturing full screen:", error);
    return { success: false, error: error.message };
  }
};

// IPC handler để bắt đầu chụp màn hình
ipcMain.handle(
  "start-screen-capture",
  async (event, displayId, interval = 500) => {
    try {
      // Dừng capture cũ nếu có
      if (screenCaptureInterval) {
        clearInterval(screenCaptureInterval);
        screenCaptureInterval = null;
      }

      screenCaptureDisplayId = displayId;
      console.log(
        `Starting screen capture for display ${displayId} at ${interval}ms interval`
      );

      // Capture ngay lập tức
      const captureResult = await captureFullScreen(displayId);
      if (captureResult.success && captureResult.imageData && mainWindow) {
        mainWindow.webContents.send("screen-capture-frame", {
          imageData: captureResult.imageData,
          displayId: displayId,
        });
      }

      // Bắt đầu interval để capture liên tục
      screenCaptureInterval = setInterval(async () => {
        try {
          const captureResult = await captureFullScreen(displayId);
          if (captureResult.success && captureResult.imageData && mainWindow) {
            mainWindow.webContents.send("screen-capture-frame", {
              imageData: captureResult.imageData,
              displayId: displayId,
            });
          }
        } catch (error) {
          console.error("Error capturing screen frame:", error);
        }
      }, interval);

      return { success: true };
    } catch (error) {
      console.error("Error starting screen capture:", error);
      return { success: false, error: error.message };
    }
  }
);

// IPC handler để dừng chụp màn hình
ipcMain.handle("stop-screen-capture", async () => {
  try {
    if (screenCaptureInterval) {
      clearInterval(screenCaptureInterval);
      screenCaptureInterval = null;
    }
    screenCaptureDisplayId = null;
    console.log("Screen capture stopped");
    return { success: true };
  } catch (error) {
    console.error("Error stopping screen capture:", error);
    return { success: false, error: error.message };
  }
});

// IPC handler để chụp màn hình 1 lần (không real-time)
ipcMain.handle("capture-screen-once", async (event, displayId) => {
  try {
    console.log(`Capturing screen once for display ${displayId}`);
    const captureResult = await captureFullScreen(displayId);

    if (captureResult.success && captureResult.imageData) {
      return {
        success: true,
        imageData: captureResult.imageData,
        displayId: displayId
      };
    } else {
      return {
        success: false,
        error: captureResult.error || "Failed to capture screen"
      };
    }
  } catch (error) {
    console.error("Error capturing screen once:", error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  try {
    // Khởi động server tương ứng với môi trường
    if (isDev) {
      console.log("🚀 Starting in DEVELOPMENT mode...");

      // Development: Khởi động API dev server
      console.log("Starting API dev server...");
      startApiDev().catch((err) => {
        console.warn("API dev server warning:", err.message);
      });

      // Development: Khởi động Next.js dev server
      console.log("Starting Next.js dev server...");
      startNextDev();

      // Đợi một chút để server khởi động
      setTimeout(() => {
        createWindow();
      }, 5000);
    } else {
      console.log("🚀 Starting in PRODUCTION mode...");

      // Production: Khởi động API server
      console.log("Starting API server...");
      await startApiServer();

      // Production: Khởi động static HTTP server
      console.log("Starting static server...");
      await startStaticServer();

      createWindow();
    }
  } catch (err) {
    console.error("Failed to start application:", err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Dừng tất cả processes
const stopAllProcesses = async (force = false) => {
  console.log("Stopping all processes...");

  // Dừng Next.js dev server nếu đang chạy
  if (nextProcess) {
    console.log("Stopping Next.js dev server...");
    try {
      if (force) {
        nextProcess.kill("SIGKILL");
      } else {
        nextProcess.kill("SIGTERM");
        // Đợi một chút để process tự tắt, nếu không thì force kill
        setTimeout(() => {
          if (nextProcess && !nextProcess.killed) {
            console.log("Force killing Next.js dev server...");
            nextProcess.kill("SIGKILL");
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error stopping Next.js dev server:", err);
    }
    nextProcess = null;
  }

  // Kill process trên port 3000 (Next.js dev server) để đảm bảo
  console.log("Killing processes on port 3000 (Next.js)...");
  await killProcessOnPort(3000);

  // Dừng API server nếu đang chạy
  if (apiProcess) {
    console.log("Stopping API server...");
    try {
      const pid = apiProcess.pid;

      if (force) {
        // Force kill: dùng SIGKILL ngay lập tức
        console.log(`Force killing API server (PID: ${pid})...`);
        try {
          apiProcess.kill("SIGKILL");
        } catch (e) {
          // Nếu kill() không work, thử kill bằng process ID
          if (pid) {
            try {
              process.kill(pid, "SIGKILL");
            } catch (e2) {
              console.error("Failed to kill API process:", e2);
            }
          }
        }
        // Kill process trên port để đảm bảo
        const apiPort = getApiPort(API_LINK);
        await killProcessOnPort(apiPort);
      } else {
        // Graceful shutdown: gửi SIGTERM trước
        console.log(`Sending SIGTERM to API server (PID: ${pid})...`);
        try {
          apiProcess.kill("SIGTERM");
        } catch (e) {
          if (pid) {
            try {
              process.kill(pid, "SIGTERM");
            } catch (e2) {
              console.error("Failed to send SIGTERM:", e2);
            }
          }
        }

        // Đợi một chút để process tự tắt, nếu không thì force kill
        setTimeout(async () => {
          if (apiProcess && !apiProcess.killed && pid) {
            console.log(`Force killing API server (PID: ${pid})...`);
            try {
              apiProcess.kill("SIGKILL");
            } catch (e) {
              try {
                process.kill(pid, "SIGKILL");
              } catch (e2) {
                console.error("Failed to force kill API process:", e2);
              }
            }
            // Kill process trên port để đảm bảo
            const apiPort = getApiPort(API_LINK);
            await killProcessOnPort(apiPort);
          }
        }, 2000); // Tăng timeout lên 2 giây
      }

      // Đợi một chút để đảm bảo process đã tắt
      setTimeout(() => {
        apiProcess = null;
      }, 100);
    } catch (err) {
      console.error("Error stopping API server:", err);
      apiProcess = null;
    }
  } else {
    // Nếu không có apiProcess reference, vẫn thử kill process trên port
    console.log("No API process reference, killing process on port...");
    const apiPort = getApiPort(API_LINK);
    await killProcessOnPort(apiPort);
  }

  // Luôn kill process trên port API để đảm bảo (dù có reference hay không)
  const apiPort = getApiPort(API_LINK);
  console.log(`Killing processes on port ${apiPort} (API server)...`);
  await killProcessOnPort(apiPort);

  // Dừng static server nếu đang chạy
  if (staticServer) {
    console.log("Stopping static server...");
    try {
      staticServer.close();
    } catch (err) {
      console.error("Error stopping static server:", err);
    }
    staticServer = null;
  }

  // Kill process trên port static server để đảm bảo
  console.log(
    `Killing processes on port ${staticServerPort} (Static server)...`
  );
  await killProcessOnPort(staticServerPort);

  console.log("All processes stopped.");
};

// Đóng selection window nếu đang mở
const closeSelectionWindow = () => {
  if (selectionWindow) {
    console.log("Closing selection window...");
    try {
      selectionWindow.close();
    } catch (err) {
      console.error("Error closing selection window:", err);
    }
    selectionWindow = null;
  }
};

app.on("window-all-closed", (event) => {
  // Đóng selection window trước
  closeSelectionWindow();

  // Dừng tất cả processes
  stopAllProcesses();

  if (process.platform !== "darwin") {
    app.quit();
  } else {
    // Trên macOS, vẫn quit app khi đóng window
    app.quit();
  }
});

app.on("before-quit", (event) => {
  console.log("App is about to quit, stopping all processes...");
  closeSelectionWindow();
  stopAllProcesses();
});

app.on("will-quit", (event) => {
  console.log("App will quit, force stopping all processes...");
  closeSelectionWindow();
  stopAllProcesses(true); // Force kill
});

// Xử lý khi app bị terminate đột ngột
process.on("SIGINT", async () => {
  console.log("Received SIGINT, stopping all processes...");
  await stopAllProcesses(true);
  app.quit();
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, stopping all processes...");
  await stopAllProcesses(true);
  app.quit();
});

// Xử lý uncaught exceptions
process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  await stopAllProcesses(true);
  app.quit();
});
