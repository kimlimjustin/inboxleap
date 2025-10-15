import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { s3EmailBackupProcessor } from "./services/s3EmailBackupProcessor.js";
import { automatedBlacklistService } from "./services/automatedBlacklistService.js";

// Load configuration
const configPath = path.resolve(import.meta.dirname, "..", "..", "..", "config.json");
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf-8")) : {};
const ports = config.ports || { frontend: 5173, backend: 3000 };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    const distPath = path.resolve(import.meta.dirname, "..", "..", "..", "apps", "web", "dist");
    if (fs.existsSync(distPath)) {
      serveStatic(app);
    }
  }

  // Serve the app on configured port or default to backend port from config
  const port = process.env.PORT || ports.backend;
  server.listen({
    port,
    host: "0.0.0.0",
  }, async () => {
    log(`serving on port ${port}`);
    
    // Start S3 email backup processor
    try {
      s3EmailBackupProcessor.start();
      log('S3 email backup processor started');
    } catch (error) {
      log(`Failed to start S3 backup processor: ${error}`);
    }
    
    // Initialize automated blacklist service
    try {
      await automatedBlacklistService.initialize();
      log('🤖 Automated blacklist service initialized');
    } catch (error) {
      log(`Failed to initialize automated blacklist service: ${error}`);
    }
    
    // Security layer removed - domain security now handled by individual agents
  });

  // Graceful shutdown handling with improved logging and timeout
  let isShuttingDown = false;
  
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      log(`Already shutting down, ignoring ${signal}`);
      return;
    }
    
    isShuttingDown = true;
    log(`🔄 [SHUTDOWN] Received ${signal}, initiating graceful shutdown...`);
    
    // Stop S3 email processor first
    try {
      s3EmailBackupProcessor.stop();
      log('📧 [SHUTDOWN] S3 email backup processor stopped');
    } catch (error) {
      log(`❌ [SHUTDOWN] Error stopping S3 processor: ${error}`);
    }
    
    // Give ongoing requests time to complete (30 seconds max)
    const shutdownTimeout = setTimeout(() => {
      log('⏰ [SHUTDOWN] Forcing shutdown after timeout');
      process.exit(1);
    }, 30000);
    
    server.close((err) => {
      clearTimeout(shutdownTimeout);
      if (err) {
        log(`❌ [SHUTDOWN] Error during server close: ${err}`);
        process.exit(1);
      } else {
        log('✅ [SHUTDOWN] Server closed successfully');
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', (error) => {
    log(`💥 [FATAL] Uncaught exception: ${error.message}`);
    console.error(error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    log(`💥 [FATAL] Unhandled rejection at: ${promise}, reason: ${reason}`);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
})();
