import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ILoginDto, IRegisterDto } from '@meago/core';

export class RegisterDto implements IRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginDto implements ILoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
