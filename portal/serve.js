"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const port = parseInt(process.env.PORT ?? "5173", 10);
const base = path_1.default.resolve(__dirname, "..");
const roots = {
    manutenzioni: path_1.default.join(base, "apps", "manutenzioni", "dist"),
    "ticket-it": path_1.default.join(base, "apps", "ticket-it", "dist"),
    utenti: path_1.default.join(base, "apps", "utenti", "dist"),
    locker: path_1.default.join(base, "apps", "locker", "dist"),
    vending: path_1.default.join(base, "apps", "vending", "dist"),
    shared: path_1.default.join(base, "shared"),
};
const homeRoot = __dirname;
const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
};
function send(res, filePath) {
    fs_1.default.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        const ext = path_1.default.extname(filePath);
        const contentType = types[ext] ?? "application/octet-stream";
        if (ext === ".html") {
            let injection = "";
            const apiBaseUrl = process.env.API_BASE_URL;
            const msalClientId = process.env.MSAL_CLIENT_ID;
            const msalTenantId = process.env.MSAL_TENANT_ID;
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
http_1.default
    .createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    const segments = url.split("/").filter(Boolean);
    const app = segments[0];
    if (app && roots[app]) {
        const rest = "/" + segments.slice(1).join("/");
        const filePath = path_1.default.join(roots[app], rest === "/" ? "/index.html" : rest);
        // SPA fallback: if the file doesn't exist, serve index.html for client-side routing
        if (!fs_1.default.existsSync(filePath) || fs_1.default.statSync(filePath).isDirectory()) {
            send(res, path_1.default.join(roots[app], "index.html"));
        }
        else {
            send(res, filePath);
        }
        return;
    }
    const filePath = path_1.default.join(homeRoot, url === "/" ? "/index.html" : url);
    // SPA fallback for home portal
    if (url !== "/" && !fs_1.default.existsSync(filePath)) {
        send(res, path_1.default.join(homeRoot, "index.html"));
    }
    else {
        send(res, filePath);
    }
})
    .listen(port, () => console.log(`Portale Urban Homy su http://localhost:${port}`));
