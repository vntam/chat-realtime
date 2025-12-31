import {
  createProxyMiddleware,
  RequestHandler,
  Options,
} from 'http-proxy-middleware';
import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';

const logger = new Logger('ReverseProxy');

export function createReverseProxyMiddleware(
  path: string,
  target: string,
): RequestHandler<any, any> {
  const options: Options<any, any> = {
    target,
    changeOrigin: true,
    pathRewrite: (reqPath: string, req: any) => {
      // Express strips the prefix (e.g., /auth) before passing to middleware
      // We need to add it back for downstream services
      // IMPORTANT: If req.path is '/', return empty string to avoid duplicate prefix
      // Example: /auth/login → req.path = /login → return /auth/login
      // Example: /conversations → req.path = / → return /conversations (not /conversations/)
      if (req.path === '/') {
        return path; // Return the prefix only, no trailing slash
      }
      return path + req.path;
    },
    ws: false, // WebSocket handled separately
    on: {
      proxyReq: (proxyReq, req: any) => {
        // Debug: Log all headers
        console.log(`[ReverseProxy] [${req.id}] Incoming headers:`, Object.keys(req.headers || {}).join(', '));
        console.log(`[ReverseProxy] [${req.id}] Authorization present:`, !!req.headers?.authorization);

        // Forward trace-id and user info from gateway to downstream
        if (req.id) {
          proxyReq.setHeader('x-trace-id', req.id as string);
        }
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.sub as string);
          proxyReq.setHeader(
            'x-user-roles',
            JSON.stringify(req.user.roles || []),
          );
        }

        // IMPORTANT: Forward cookies to downstream services
        // This is required for HttpOnly cookie authentication
        if (req.headers.cookie) {
          proxyReq.setHeader('cookie', req.headers.cookie);
        }

        // CRITICAL: Forward Authorization header to downstream services
        // This is required for Bearer token authentication
        if (req.headers.authorization) {
          proxyReq.setHeader('authorization', req.headers.authorization);
          console.log(`[ReverseProxy] [${req.id}] Forwarding Authorization header:`, req.headers.authorization.substring(0, 20) + '...');
        } else {
          console.warn(`[ReverseProxy] [${req.id}] NO Authorization header to forward!`);
        }

        console.log(`[ReverseProxy] [${req.id}] Proxy ${req.method} ${req.originalUrl} → ${target}${req.path}`);
      },
      proxyRes: (proxyRes, req: any) => {
        proxyRes.headers['x-trace-id'] = req.id;
        console.log(`[ReverseProxy] [${req.id}] Response status: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },
      error: (err, req: any, res) => {
        console.error(`[ReverseProxy] [${req.id}] Proxy error: ${err.message}`, err);
        logger.error(`[${req.id}] Proxy error: ${err.message}`);
        res.status(502).json({
          statusCode: 502,
          message: 'Bad Gateway',
          detail: 'Gateway failed to reach downstream service',
          timestamp: new Date().toISOString(),
        });
      },
    },
  };

  const proxy = createProxyMiddleware(options);

  // Wrapper to handle CORS preflight requests
  const wrapper: any = (req: Request, res: Response, next: any) => {
    // Handle OPTIONS preflight requests directly at gateway level
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin || '*';
      logger.log(`[CORS] Handling preflight request for ${origin}`);

      // Set CORS headers - MUST be set before sendStatus
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,X-Trace-Id');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '600');
      res.setHeader('Vary', 'Origin');

      // Log headers for debugging
      logger.log(`[CORS] Headers set: Origin=${origin}, Methods=GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS`);

      res.sendStatus(204);
      return;
    }

    // For all other requests, use the proxy
    return proxy(req, res, next);
  };

  // Copy the upgrade property from proxy to wrapper for WebSocket support
  wrapper.upgrade = proxy.upgrade;

  return wrapper as RequestHandler;
}

export function createWebSocketProxyMiddleware(
  path: string,
  target: string,
): RequestHandler<any, any> {
  const options: Options<any, any> = {
    target,
    changeOrigin: true,
    ws: true, // enable WebSocket
    pathRewrite: (reqPath: string) => reqPath,
    on: {
      proxyReq: (proxyReq, req: any) => {
        if (req.id) {
          proxyReq.setHeader('x-trace-id', req.id as string);
        }
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.sub as string);
        }
        logger.debug(`[${req.id}] WebSocket upgrade ${req.url} → ${target}`);
      },
      error: (err, req: any) => {
        logger.error(`[${req.id}] WS proxy error: ${err.message}`);
      },
    },
  };

  return createProxyMiddleware(options);
}
