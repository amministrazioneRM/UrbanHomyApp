import http from "http";
import fs from "fs";
import path from "path";

const port: number = parseInt(process.env.PORT ?? "5173", 10);

const base = path.resolve(__dirname, "..");
const roots: Record<string, string> = {
  manutenzioni: path.join(base, "apps", "manutenzioni", "dist"),
  "ticket-it": path.join(base, "apps", "ticket-it", "dist"),
  utenti: path.join(base, "apps", "utenti", "dist"),
  locker: path.join(base, "apps", "locker", "dist"),
  vending: path.join(base, "apps", "vending", "dist"),
  shared: path.join(base, "shared"),
};
const homeRoot = __dirname;

const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function send(res: http.ServerResponse, filePath: string): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const contentType = types[ext] ?? "application/octet-stream";

    if (ext === ".html") {
      let injection = "";
      const apiBaseUrl: string | undefined = process.env.API_BASE_URL;
      const msalClientId: string | undefined = process.env.MSAL_CLIENT_ID;
      const msalTenantId: string | undefined = process.env.MSAL_TENANT_ID;

      if (apiBaseUrl) {
        injection += `<script>window.__UH_API_BASE__="${apiBaseUrl}";</script>`;
      }
      if (msalClientId && msalClientId !== "REPLACE_WITH_YOUR_CLIENT_ID") {
        injection += `<script>window.__UH_MSAL_CLIENT_ID__="${msalClientId}";window.__UH_MSAL_TENANT_ID__="${msalTenantId ?? ""}";</script>`;
      }
      if (injection) {
        const html = data.toString().replace("</head>", injection + "</head>");
        res.writeHead(200, { "Content-Type": contentType });
        res.end(html);
        return;
      }
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    const segments = url.split("/").filter(Boolean);
    const app = segments[0];

    if (app && roots[app]) {
      const rest = "/" + segments.slice(1).join("/");
      const filePath = path.join(roots[app], rest === "/" ? "/index.html" : rest);
      // SPA fallback: if the file doesn't exist, serve index.html for client-side routing
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        send(res, path.join(roots[app], "index.html"));
      } else {
        send(res, filePath);
      }
      return;
    }

    const filePath = path.join(homeRoot, url === "/" ? "/index.html" : url);
    // SPA fallback for home portal
    if (url !== "/" && !fs.existsSync(filePath)) {
      send(res, path.join(homeRoot, "index.html"));
    } else {
      send(res, filePath);
    }
  })
  .listen(port, () => console.log(`Portale Urban Homy su http://localhost:${port}`));
