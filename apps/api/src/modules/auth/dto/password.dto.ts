import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Length(16, 128)
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @Length(16, 128)
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
