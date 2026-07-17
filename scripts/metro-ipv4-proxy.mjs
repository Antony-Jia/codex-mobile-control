import net from "node:net";

const listenPort = Number(process.env.METRO_PROXY_PORT ?? 8082);
const targetPort = Number(process.env.METRO_PORT ?? 8081);

const server = net.createServer((client) => {
  const upstream = net.connect({ host: "::1", port: targetPort });
  client.pipe(upstream).pipe(client);
  const close = () => { client.destroy(); upstream.destroy(); };
  client.on("error", close); upstream.on("error", close);
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(`Metro IPv4 proxy listening on 127.0.0.1:${listenPort} -> [::1]:${targetPort}`);
});
