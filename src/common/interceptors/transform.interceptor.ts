import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { IBaseResponse } from '../interfaces/response.interface';

/**
 * Gói mọi response thành IBaseResponse thống nhất
 * (source mẫu wrap thủ công từng controller — đưa lên interceptor global gọn hơn).
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, IBaseResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<IBaseResponse<T>> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => ({
        statusCode: res.statusCode,
        message: 'success',
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
