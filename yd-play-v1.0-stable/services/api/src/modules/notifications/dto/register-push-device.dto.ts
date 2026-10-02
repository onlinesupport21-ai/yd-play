import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class RegisterPushDeviceDto {
  @IsString() @MinLength(10) @MaxLength(4096) token!:string;
  @IsString() @MaxLength(40) provider!:string;
  @IsIn(['android','ios','web']) platform!:'android'|'ios'|'web';
  @IsOptional() @IsString() @MaxLength(30) appVersion?:string;
}
