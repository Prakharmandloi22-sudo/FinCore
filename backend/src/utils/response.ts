import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
    [key: string]: any;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  metaData: Record<string, any> = {},
  statusCode: number = 200
): Response {
  const requestId = (res.req as any)?.id || 'unknown';
  const responsePayload: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...metaData
    }
  };
  return res.status(statusCode).json(responsePayload);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  details: any = null,
  statusCode: number = 400
): Response {
  const requestId = (res.req as any)?.id || 'unknown';
  const responsePayload: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
  return res.status(statusCode).json(responsePayload);
}
