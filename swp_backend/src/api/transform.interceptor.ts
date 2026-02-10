import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from './api-response.interface';
import { Response } from 'express';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const path = request.path;
    const method = request.method;

    // Skip transformation cho:
    // 1. OPTIONS requests (preflight)
    if (method === 'OPTIONS') {
      return next.handle() as Observable<any>;
    }

    // 2. Redirect responses (verify-email trả về redirect)
    if (path.includes('verify-email')) {
      return next.handle() as Observable<any>;
    }

    // 3. File download endpoints - kiểm tra content-type trong response
    if (path.includes('export') || path.includes('download')) {
      const originalSend = response.send.bind(response);
      
      response.send = function(body: any) {
        // Nếu body đã có headers (từ ImportExportService), không transform
        if (body && typeof body === 'object' && body.headers && body.data !== undefined) {
          this.set(body.headers);
          return originalSend(body.data);
        }
        return originalSend(body);
      };
      
      return next.handle() as Observable<any>;
    }

    // 4. Các endpoints đã trả về response có format (như upload-avatar)
    if (response.headersSent) {
      return next.handle() as Observable<any>;
    }

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data && 'timestamp' in data) {
          return data;
        }

        // Nếu data là plain object, wrap thành ApiResponse
        return {
          success: true,
          message: data?.message || 'Request successful',
          data: data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}