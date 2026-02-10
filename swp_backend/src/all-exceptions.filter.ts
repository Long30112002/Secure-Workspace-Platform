import { Catch, ArgumentsHost, HttpStatus, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { MyLoggerService } from './my-logger/my-logger.service';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

type MyResponseObj = {
    statusCode: number,
    timestamp: string,
    path: string,
    response: string | object,
    method: string,
    ip?: string,
    userAgent?: string
}

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
    private readonly logger: MyLoggerService;
    constructor(
        logger: MyLoggerService,
        httpAdapter?:any
    ){
        super(httpAdapter);
        this.logger = logger;
    }
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const myResponseObj: MyResponseObj = {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            timestamp: new Date().toISOString(),
            path: request.url,
            response: 'Internal Server Error',
            method: request.method,
            ip: request.ip,
            userAgent: request.get('user-agent')
        }

        if (exception instanceof HttpException) {
            myResponseObj.statusCode = exception.getStatus();
            myResponseObj.response = exception.getResponse();
        } else if (exception instanceof Prisma.PrismaClientValidationError) {
            myResponseObj.statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
            myResponseObj.response = {
                message: 'Validation failed',
                details: exception.message.replaceAll(/\n/g, '')
            };
        } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            myResponseObj.statusCode = HttpStatus.BAD_REQUEST;
            myResponseObj.response = this.handlePrismaError(exception);
        } else if (exception instanceof Error) {
            myResponseObj.response = exception.message;
        }

        this.logger.error({
            message: myResponseObj.response,
            statusCode: myResponseObj.statusCode,
            path: myResponseObj.path,
            method: myResponseObj.method,
            ip: myResponseObj.ip,
            timestamp: myResponseObj.timestamp,
            stack: exception instanceof Error ? exception.stack : undefined
        }, AllExceptionsFilter.name);

        response
            .status(myResponseObj.statusCode)
            .json({
                statusCode: myResponseObj.statusCode,
                message: typeof myResponseObj.response === 'object'
                    ? (myResponseObj.response as any).message || 'Error'
                    : myResponseObj.response,
                timestamp: myResponseObj.timestamp,
                path: myResponseObj.path,
                ...(typeof myResponseObj.response === 'object'
                    ? myResponseObj.response
                    : {})
            });

        // this.logger.error(myResponseObj.response, AllExceptionsFilter.name);
        // super.catch(exception, host);
    }
    private handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002':
                return {
                    message: 'Unique constraint failed',
                    fields: error.meta?.target
                };
            case 'P2025':
                return {
                    mesaage: 'Record not found',
                    targer: error.meta?.modelName
                };
            default:
                return {
                    message: 'Database error occurred',
                    code: error.code
                };
        }
    }
}