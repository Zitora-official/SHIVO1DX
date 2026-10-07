const http = require('http');
const fs = require('fs');
const path = require('path');


const appPkgPath = path.join(__dirname, "appPkg.json");
const APP_PACKAGES = Object.fromEntries(
  Object.entries(
      JSON.parse(fs.readFileSync(appPkgPath, "utf8"))
  ).map(([name, packageName]) => [
      name.trim().toLowerCase(),
      packageName
  ])
);







const PORT = 8080;

http.createServer((req, res) => {
  // --- PHONE DISPATCH BRIDGE (Native http.request) ---
  if (req.method === 'POST' && req.url === '/dispatch-phone') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const clientData = JSON.parse(body);

        let parameters = clientData.parameters || {};

        if (clientData.action === "open_app") {

          const appName = String(parameters.app_name || "")
            .trim()
            .toLowerCase();

          const packageName = APP_PACKAGES[appName];

          if (!packageName) {

            res.writeHead(400, {
              "Content-Type": "application/json"
            });

            res.end(JSON.stringify({
              status: "error",
              message: `App "${parameters.app_name || "unknown"}" is not registered in appPkg.json`
            }));

            return;
          }

          parameters = {
            package: packageName
          };
        }

        const commandPayload = JSON.stringify({
          action: clientData.action,
          parameters: parameters
        });

        const options = {
          hostname: "10.32.72.177",
          port: 9000,
          path: "/shivoid",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(commandPayload)
          }
        };

        const phoneReq = http.request(options, (phoneRes) => {

          console.log("PHONE RESPONSE STATUS:", phoneRes.statusCode);
          console.log("PHONE RESPONSE HEADERS:", phoneRes.headers);

          let result = "";

          phoneRes.on("data", chunk => {
            console.log("PHONE RESPONSE CHUNK:", chunk.toString());
            result += chunk;
          });

          phoneRes.on("end", () => {

            console.log("PHONE RESPONSE ENDED");
            console.log("RAW AUTOMATE RESPONSE:", JSON.stringify(result));

            try {

              const automateResult = JSON.parse(result);

              res.writeHead(200, {
                "Content-Type": "application/json"
              });

              res.end(JSON.stringify(automateResult));

            } catch (error) {

              console.log("AUTOMATE JSON PARSE ERROR:", error.message);

              res.writeHead(502, {
                "Content-Type": "application/json"
              });

              res.end(JSON.stringify({
                status: "error",
                message: "Invalid response received from Automate"
              }));
            }
          });
        });

        phoneReq.on("error", (error) => {
          console.error("Connection failed to phone:", error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: "failed", error: error.message }));
        });

        phoneReq.write(commandPayload);
        phoneReq.end();

      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "failed", error: "Invalid JSON" }));
      }
    });
    return;
  }

  // --- EXISTING STATIC FILE SERVER ---
  let safePath = req.url === '/' ? '/singleindex' : req.url;
  let filePath = path.join(__dirname, safePath);

  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (fs.existsSync(filePath + '.htm')) {
      filePath += '.htm';
    }
  }

  let extname = String(path.extname(filePath)).toLowerCase();
  let mimeTypes = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
  };

  let contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`<h1>404 Not Found</h1><p>Tried to load: ${filePath}</p>`);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Server running! Open http://localhost:${PORT} on your PC`);
});