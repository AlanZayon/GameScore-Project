import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'player@example.com', maxLength: 255 })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'darksoulsfan',
    description: 'Letters, numbers and underscore only. Stored lowercase and used in URLs.',
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @Length(3, 30)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'username may only contain letters, numbers and underscore',
  })
  username!: string;

  @ApiProperty({
    example: 'Str0ngPassword',
    description: 'At least 8 characters, including a letter and a number.',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @Length(8, 128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;

  @ApiPropertyOptional({ example: 'Dark Souls Fan', maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  displayName?: string;
}
