import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsNumber, IsObject, IsOptional, IsString, Matches, MinLength, ValidateNested } from "class-validator";
export class ImportResultDto {
    @IsNumber()
    totalRows: number;

    @IsNumber()
    created: number;

    @IsNumber()
    updated: number;

    @IsNumber()
    skipped: number;

    @IsNumber()
    failed: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImportErrorDto)
    errors: ImportErrorDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImportSuccessDto)
    successes?: ImportSuccessDto[];

    @IsNumber()
    successCount: number;

    @IsNumber()
    executionTimeMs: number;
}

export class ImportErrorDto {
    @IsNumber()
    row: number;

    @IsString()
    email: string;

    @IsString()
    reason: string;

    @IsOptional()
    @IsString()
    details?: string;

    @IsOptional()
    @IsString()
    field?: string;

    @IsOptional()
    @IsString()
    suggestion?: string;
}

export class ImportSuccessDto {
    @IsNumber()
    row: number;

    @IsString()
    email: string;

    @IsString()
    action: 'created' | 'updated' | 'skipped';

    @IsOptional()
    @IsString()
    temporaryPassword?: string;

    @IsOptional()
    @IsObject()
    changes?: Record<string, any>;
}