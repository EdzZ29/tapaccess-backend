import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

/**
 * Every error leaves the API in the same shape. Unexpected errors are logged
 * with their stack but reported to the client as a generic 500, so database
 * messages and internals never leak.
 */
/** 404 -> "Not Found" */
const statusText = (status: number) =>
  (HttpStatus[status] ?? 'Error')
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const body = this.toBody(exception, req);
    if (body.statusCode >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, req: Request): ErrorBody {
    const base = { path: req.originalUrl, timestamp: new Date().toISOString() };

    if (exception instanceof ThrottlerException) {
      return {
        ...base,
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many requests, please slow down.',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return {
          ...base,
          statusCode: status,
          error: statusText(status),
          message: response,
        };
      }
      const r = response as {
        message?: string | string[];
        error?: string;
        code?: string;
        details?: unknown;
      };
      // ValidationPipe reports an array of messages; surface the first as the
      // headline and keep the full list in `details`.
      const messages = Array.isArray(r.message) ? r.message : undefined;
      return {
        ...base,
        statusCode: status,
        error: r.error ?? statusText(status),
        message: messages
          ? messages[0]
          : typeof r.message === 'string'
            ? r.message
            : exception.message,
        code: r.code,
        details: messages ?? r.details,
      };
    }

    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)
        ?.code;
      if (code === '23505') {
        return {
          ...base,
          statusCode: 409,
          error: 'Conflict',
          message: 'A record with these values already exists.',
        };
      }
      if (code === '23503') {
        return {
          ...base,
          statusCode: 409,
          error: 'Conflict',
          message: 'A related record is missing or still in use.',
        };
      }
      if (code === '22P02') {
        return {
          ...base,
          statusCode: 400,
          error: 'Bad Request',
          message: 'Malformed identifier.',
        };
      }
    }

    return {
      ...base,
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong.',
    };
  }
}
