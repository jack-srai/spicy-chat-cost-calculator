/* Optional local preview. Node built-ins only; binds exclusively to localhost. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = __dirname;
const allowed = new Set(["index.html", "styles.css", "calculator.js", "app.js", "pepper.png", "preview.jpg"]);
http.createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
  if (!allowed.has(name)) { res.writeHead(404); res.end("Not found"); return; }
  const file = path.join(root, name);
  const type = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg" }[path.extname(file)];
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" }); res.end(bytes);
  });
}).listen(4177, "127.0.0.1", () => console.log("Spicy Chat Cost Calculator: http://127.0.0.1:4177"));
