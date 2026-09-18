import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseEnvelope } from '../response-envelope';
import { ResponseCode } from '../response-code';

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({
        requestSuccessful: true,
        responseMessage: 'success',
        responseCode: ResponseCode.SUCCESS,
        responseBody: (data ?? null) as T,
      })),
    );
  }
}
