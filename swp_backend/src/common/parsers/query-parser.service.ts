// src/common/parsers/query.parser.service.ts
import { Injectable } from '@nestjs/common';

export interface QueryParserOptions {
    defaultPage?: number;
    defaultLimit?: number;
    maxLimit?: number;
    booleanFields?: string[];
    numberFields?: string[];
    dateFields?: string[];
}

@Injectable()
export class QueryParserService {
    parseQuery<T>(
        rawQuery: any,
        options: QueryParserOptions = {}
    ): T {
        const result: any = {};

        const {
            defaultPage = 1,
            defaultLimit = 10,
            maxLimit = 100,
            booleanFields = [],
            numberFields = ['page', 'limit'],
            dateFields = []
        } = options;

        // Parse từng field
        for (const [key, value] of Object.entries(rawQuery || {})) {
            if (value === undefined || value === null) continue;

            // Boolean fields
            if (booleanFields.includes(key)) {
                result[key] = this.parseBoolean(value);
            }
            // Number fields
            else if (numberFields.includes(key)) {
                if (key === 'page') {
                    result[key] = this.parseNumber(value, defaultPage, 1);
                } else if (key === 'limit') {
                    result[key] = this.parseNumber(value, defaultLimit, 1, maxLimit);
                } else {
                    result[key] = this.parseNumber(value);
                }
            }
            // Date fields
            else if (dateFields.includes(key)) {
                result[key] = this.parseDate(value);
            }
            // String fields (default)
            else {
                result[key] = value;
            }
        }

        // Ensure pagination
        result.page = result.page || defaultPage;
        result.limit = result.limit || defaultLimit;

        return result as T;
    }

    // Các helper methods có thể dùng riêng
    parseBoolean(value: any): boolean | undefined {
        if (value === undefined || value === null) return undefined;

        const strVal = String(value).toLowerCase().trim();

        if (['true', '1', 'yes', 'on', 'y'].includes(strVal)) return true;
        if (['false', '0', 'no', 'off', 'n'].includes(strVal)) return false;

        // Try boolean conversion
        try {
            return Boolean(value);
        } catch {
            return undefined;
        }
    }

    parseNumber(
        value: any,
        defaultValue?: number,
        min?: number,
        max?: number
    ): number | undefined {
        if (value === undefined || value === null) {
            return defaultValue;
        }

        const num = Number(value);
        if (isNaN(num)) return defaultValue;

        let result = num;
        if (min !== undefined) result = Math.max(min, result);
        if (max !== undefined) result = Math.min(max, result);

        return result;
    }

    parseDate(value: any): Date | undefined {
        if (!value) return undefined;

        try {
            const date = new Date(value);
            return isNaN(date.getTime()) ? undefined : date;
        } catch {
            return undefined;
        }
    }

    // Method riêng cho từng module (nếu cần)
    parseUserQuery(rawQuery: any): any {
        return this.parseQuery(rawQuery, {
            booleanFields: ['isEmailVerified', 'isActive', 'includeDeleted'],
            numberFields: ['page', 'limit'],
            maxLimit: 100,
        });
    }

    parseProductQuery(rawQuery: any): any {
        return this.parseQuery(rawQuery, {
            booleanFields: ['isActive', 'inStock', 'isFeatured'],
            numberFields: ['page', 'limit', 'minPrice', 'maxPrice', 'categoryId'],
            dateFields: ['createdAfter', 'createdBefore'],
            maxLimit: 50
        });
    }

    parseOrderQuery(rawQuery: any): any {
        return this.parseQuery(rawQuery, {
            booleanFields: ['isPaid', 'isShipped'],
            numberFields: ['page', 'limit', 'minAmount', 'maxAmount'],
            dateFields: ['fromDate', 'toDate'],
            maxLimit: 50
        });
    }
}