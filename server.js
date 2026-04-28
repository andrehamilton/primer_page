const http = require("http");
const fs = require("fs");
const path = require("path");

const startPort = Number(process.env.PORT) || 3000;
const root = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.normalize(path.join(root, requestedPath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Archivo no encontrado");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": contentTypes[ext] || "application/octet-stream"
      });
      res.end(content);
    });
  });
}

function listen(port) {
  const server = createServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`Servidor listo en http://localhost:${port}`);
  });
}

listen(startPort);
