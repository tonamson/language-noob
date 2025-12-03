const { app, BrowserWindow } = require("electron/main");
const path = require("path");
const { spawn, fork } = require("child_process");
const http = require("http");
const fs = require("fs");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let nextProcess = null;
let apiProcess = null;
let staticServer = null;
let staticServerPort = 3456; // Port cho static server trong production

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

// Khởi động API server
const startApiServer = () => {
  return new Promise((resolve, reject) => {
    const apiPath = getApiPath();
    const apiMainFile = path.join(apiPath, "dist", "main.js");

    console.log("Starting API server from:", apiMainFile);

    // Kiểm tra file tồn tại
    if (!fs.existsSync(apiMainFile)) {
      console.error("API main.js not found at:", apiMainFile);
      reject(new Error(`API file không tồn tại: ${apiMainFile}`));
      return;
    }

    // Parse port từ API_LINK nếu là localhost (để set PORT env)
    // Nếu không phải localhost, API sẽ tự động setup port của nó
    let apiPort = null;
    try {
      const url = new URL(API_LINK);
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
        apiPort = url.port || (url.protocol === "https:" ? 443 : 80);
      }
    } catch (err) {
      console.warn("Failed to parse API_LINK:", err.message);
    }

    // Spawn Node process để chạy API
    // API sẽ tự động đọc PORT từ environment variable hoặc dùng default
    const env = {
      ...process.env,
      NODE_ENV: "production",
    };

    // Chỉ set PORT nếu là localhost (API local)
    if (apiPort) {
      env.PORT = apiPort.toString();
    }

    apiProcess = fork(apiMainFile, [], {
      cwd: apiPath,
      env,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

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

    apiProcess.on("exit", (code) => {
      console.log(`API server exited with code ${code}`);
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
    });

    apiProcess.on("error", (err) => {
      console.error("Failed to start API dev server:", err);
      reject(err);
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
const stopAllProcesses = () => {
  // Dừng Next.js dev server nếu đang chạy
  if (nextProcess) {
    console.log("Stopping Next.js dev server...");
    nextProcess.kill();
    nextProcess = null;
  }

  // Dừng API server nếu đang chạy
  if (apiProcess) {
    console.log("Stopping API server...");
    apiProcess.kill();
    apiProcess = null;
  }

  // Dừng static server nếu đang chạy
  if (staticServer) {
    console.log("Stopping static server...");
    staticServer.close();
    staticServer = null;
  }
};

app.on("window-all-closed", () => {
  stopAllProcesses();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopAllProcesses();
});
