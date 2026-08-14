import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'player@example.com',
    description: 'Email address or username.',
  })
  @IsString()
  @Length(3, 255)
  identifier!: string;

  @ApiProperty({ example: 'Str0ngPassword' })
  @IsString()
  @Length(1, 128)
  password!: string;
}
