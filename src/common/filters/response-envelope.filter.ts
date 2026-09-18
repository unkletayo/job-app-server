import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ResponseEnvelope } from '../response-envelope';
import { ResponseCode } from '../response-code';

@Catch()
export class ResponseEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ResponseEnvelope<null> = {
      requestSuccessful: false,
      responseMessage: extractMessage(exception),
      responseCode: resolveResponseCode(exception),
      responseBody: null,
    };

    response.status(status).json(body);
  }
}

// Maps exception scenarios to the defined ResponseCode vocabulary — never the
// raw HTTP status number, so the code stays stable even if a status changes.
function resolveResponseCode(exception: unknown): ResponseCode {
  if (exception instanceof BadRequestException) return ResponseCode.VALIDATION_ERROR;
  if (exception instanceof UnauthorizedException) return ResponseCode.UNAUTHORIZED;
  if (exception instanceof ForbiddenException) return ResponseCode.FORBIDDEN;
  if (exception instanceof NotFoundException) return ResponseCode.NOT_FOUND;
  if (exception instanceof ConflictException) return ResponseCode.CONFLICT;
  return ResponseCode.INTERNAL_ERROR;
}

function extractMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message: unknown }).message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
    return exception.message;
  }
  return 'Internal server error';
}
