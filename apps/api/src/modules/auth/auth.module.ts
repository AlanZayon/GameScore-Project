import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';
import { PasswordHasher } from './domain/password-hasher';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * Secrets are passed per signing call rather than configured once on the
 * module, because access and refresh tokens deliberately use different keys.
 */
@Global()
@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordHasher,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [TokenService, PasswordHasher, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, UsersModule],
})
export class AuthModule {}
