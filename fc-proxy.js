const http = require("http");

// Start Next.js on internal port 3001
process.env.PORT = "3001";
require("./server.js");

function startProxy() {
  const proxy = http.createServer((clientReq, clientRes) => {
    const opts = {
      hostname: "127.0.0.1",
      port: 3001,
      path: clientReq.url,
      method: clientReq.method,
      headers: clientReq.headers,
    };

    const proxyReq = http.request(opts, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      headers["content-disposition"] = "inline";
      clientRes.writeHead(proxyRes.statusCode || 500, headers);
      proxyRes.pipe(clientRes);
    });

    proxyReq.on("error", (e) => {
      console.error("Proxy error:", e.message);
      clientRes.writeHead(502);
      clientRes.end("Bad Gateway");
    });

    clientReq.pipe(proxyReq);
  });

  proxy.listen(3000, () => {
    console.log("Proxy listening on port 3000");
  });
}

let retries = 0;
function waitForNext() {
  const req = http.get("http://127.0.0.1:3001/", (res) => {
    res.resume();
    startProxy();
  });
  req.on("error", () => {
    retries++;
    if (retries > 30) { console.error("Next.js failed to start"); process.exit(1); }
    setTimeout(waitForNext, 1000);
  });
}
setTimeout(waitForNext, 2000);
