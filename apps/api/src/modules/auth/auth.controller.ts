import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthSessionResponse, AuthenticatedUser } from '@gamescore/types';
import type { Request, Response } from 'express';

import { AppConfigService } from '../../common/config/app-config.service';
import { UnauthorizedError } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AuthService, type AuthResult } from './application/auth.service';
import { Authenticated } from './decorators/auth.decorators';
import { CurrentUser } from './decorators/current-user.decorator';
import { REFRESH_TOKEN_COOKIE } from './domain/auth-user';
import type { AuthUser } from './domain/auth-user';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto, VerifyEmailDto } from './dto/password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  // Registration is the most abused endpoint of any public site, so it is the
  // most tightly limited one.
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Create an account and start a session' })
  @ApiCreatedResponse({ description: 'Account created and signed in' })
  @ApiConflictResponse({ description: 'Email or username already in use' })
  @ApiTooManyRequestsResponse({ description: 'Too many registrations from this client' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const result = await this.auth.register(dto, request.headers['user-agent']);
    return this.completeSession(response, result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60 * 1000, blockDuration: 5 * 60 * 1000 } })
  @ApiOperation({ summary: 'Sign in with email or username' })
  @ApiOkResponse({ description: 'Signed in' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts; try again later' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const result = await this.auth.login(dto, request.headers['user-agent']);
    return this.completeSession(response, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60 * 60 * 1000 } })
  @ApiOperation({
    summary: 'Exchange the refresh cookie for a new access token',
    description:
      'Reads the httpOnly refresh cookie, rotates it, and returns a fresh access token. ' +
      'Replaying an already rotated token revokes every session for that account.',
  })
  @ApiOkResponse({ description: 'New access token issued' })
  @ApiUnauthorizedResponse({ description: 'Missing, expired or already used refresh token' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const token = this.readRefreshCookie(request);
    if (!token) {
      throw new UnauthorizedError(ERROR_CODES.INVALID_REFRESH_TOKEN, 'No refresh token provided');
    }

    try {
      const result = await this.auth.refresh(token, request.headers['user-agent']);
      return this.completeSession(response, result);
    } catch (error) {
      // The cookie is useless now, so do not leave it in the browser.
      this.clearRefreshCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token and clear the cookie' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @Authenticated()
  @ApiOperation({ summary: 'The signed-in account' })
  @ApiOkResponse({ description: 'Current account' })
  async me(@CurrentUser() user: AuthUser): Promise<AuthenticatedUser> {
    return this.auth.currentUser(user.id);
  }

  @Post('password')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the signed-in password' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60 * 1000, blockDuration: 5 * 60 * 1000 } })
  @ApiOperation({ summary: 'Request a password reset email. Always succeeds.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60 * 1000, blockDuration: 5 * 60 * 1000 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.password);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60 * 1000, blockDuration: 5 * 60 * 1000 } })
  @ApiOperation({ summary: 'Confirm the account email with a verification token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.auth.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60 * 1000, blockDuration: 5 * 60 * 1000 } })
  @ApiOperation({ summary: 'Resend the verification email. Always succeeds.' })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
    await this.auth.resendVerification(dto.email);
  }

  private completeSession(response: Response, result: AuthResult): AuthSessionResponse {
    this.setRefreshCookie(response, result.refreshToken.token, result.refreshToken.expiresAt);
    return result.session;
  }

  /**
   * The refresh token lives in an httpOnly cookie so no script can read it,
   * while the access token stays in memory in the browser. `sameSite: lax` is
   * enough here because the web app and the API share the `localhost` site
   * (cookie scope ignores the port).
   */
  private setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      path: '/',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      path: '/',
    });
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_TOKEN_COOKIE];
  }
}
