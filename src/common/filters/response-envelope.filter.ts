import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ResponseEnvelope } from '../response-envelope';

@Catch()
export class ResponseEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ResponseEnvelope<null> = {
      requestSuccessful: false,
      responseMessage: extractMessage(exception),
      responseCode: String(status),
      responseBody: null,
    };

    response.status(status).json(body);
  }
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
