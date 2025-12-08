import {
  createProxyMiddleware,
  RequestHandler,
  Options,
} from 'http-proxy-middleware';
import { Logger } from '@nestjs/common';

const logger = new Logger('ReverseProxy');

export function createReverseProxyMiddleware(
  path: string,
  target: string,
): RequestHandler<any, any> {
  const options: Options<any, any> = {
    target,
    changeOrigin: true,
    pathRewrite: (reqPath: string) => reqPath, // keep original path
    ws: false, // WebSocket handled separately
    on: {
      proxyReq: (proxyReq, req: any) => {
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
        logger.debug(
          `[${req.id}] Proxy ${req.method} ${req.originalUrl} → ${target}`,
        );
      },
      proxyRes: (proxyRes, req: any) => {
        proxyRes.headers['x-trace-id'] = req.id;
      },
      error: (err, req: any, res) => {
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

  return createProxyMiddleware(options);
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
