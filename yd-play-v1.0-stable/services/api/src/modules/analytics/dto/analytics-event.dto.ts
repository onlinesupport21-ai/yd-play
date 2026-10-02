import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class AnalyticsEventItemDto {
  @IsString() @MaxLength(80) eventId!:string;
  @IsString() @MaxLength(80) eventName!:string;
  @IsDateString() occurredAt!:string;
  @IsOptional() @IsString() @MaxLength(30) platform?:string;
  @IsOptional() @IsString() @MaxLength(30) appVersion?:string;
  @IsOptional() @IsObject() properties?:Record<string,unknown>;
}
export class AnalyticsBatchDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>AnalyticsEventItemDto)
  events!:AnalyticsEventItemDto[];
}
