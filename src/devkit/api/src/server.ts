import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config } from './config.js';

export function createAppServer() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: config.clientUrl,
    credentials: true
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return { app, httpServer };
}
