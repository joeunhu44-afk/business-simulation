import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth/routes";
import { registerMediaRoutes } from "./mediaRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { runMigrations } from "../db";
import { warnIfEphemeralStorage } from "./storageHealth";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // 배포 플랫폼이 package.json의 prestart 훅을 건너뛰는 커스텀 Start Command를
  // 쓰더라도 마이그레이션이 항상 적용되도록, 앱 자체 부팅 과정에도 넣어둔다.
  if (process.env.NODE_ENV === "production") {
    await runMigrations();
  }

  // 업로드 파일이 재배포 때 사라지는 위치에 쌓이고 있으면 여기서 알린다.
  warnIfEphemeralStorage();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // 업로드 파일은 인증을 거쳐야 한다. express.static으로 열어두면 주소만 알면
  // 로그인 없이 누구나 볼 수 있어, 익명 글에 올린 사진도 링크가 새면 그대로 열렸다.
  registerMediaRoutes(app);
  registerAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
