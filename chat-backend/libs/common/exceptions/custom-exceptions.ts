import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
  ) {
    super(
      {
        message,
        error: 'Business Logic Error',
        statusCode,
        details,
      },
      statusCode,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    super(
      {
        message,
        error: 'Not Found',
        statusCode: HttpStatus.NOT_FOUND,
        resource,
        identifier,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UnauthorizedAccessException extends HttpException {
  constructor(message: string = 'Unauthorized access', details?: any) {
    super(
      {
        message,
        error: 'Unauthorized',
        statusCode: HttpStatus.FORBIDDEN,
        details,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(errors: Record<string, string[]>) {
    super(
      {
        message: 'Validation failed',
        error: 'Validation Error',
        statusCode: HttpStatus.BAD_REQUEST,
        errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ConflictException extends HttpException {
  constructor(message: string, details?: any) {
    super(
      {
        message,
        error: 'Conflict',
        statusCode: HttpStatus.CONFLICT,
        details,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class RateLimitException extends HttpException {
  constructor(retryAfter?: number) {
    super(
      {
        message: 'Too many requests. Please try again later.',
        error: 'Rate Limit Exceeded',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class ServiceUnavailableException extends HttpException {
  constructor(serviceName: string, details?: any) {
    super(
      {
        message: `${serviceName} is temporarily unavailable`,
        error: 'Service Unavailable',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        service: serviceName,
        details,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
