import path from 'path';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../config';
import { getDb } from '../db';
import { SqliteSessionStore } from './sessionStore';
import { apiLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth';
import { guildsRouter } from './routes/guilds';

export function createDashboardApp() {
  getDb();

  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: config.dashboardOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    session({
      name: 'nexus.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new SqliteSessionStore(),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nexus-dashboard-api' });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/guilds', guildsRouter);

  if (config.isProd) {
    const webDist = path.join(process.cwd(), 'dashboard', 'dist');
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error('[API] Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    },
  );

  return app;
}

export function startDashboardServer(): void {
  const app = createDashboardApp();
  app.listen(config.port, () => {
    console.log(`[DASHBOARD] API listening on http://localhost:${config.port}`);
    console.log(`[DASHBOARD] Frontend origin: ${config.dashboardOrigin}`);
  });
}
