import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/app-config';
import { AuthSession, RefreshToken, User, UserRoleEntity, VerificationToken } from '../database/entities';
import { MailService } from '../mail/mail.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRoleEntity, AuthSession, RefreshToken, VerificationToken]),
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => ({
        secret: cfg.jwt.secret,
        signOptions: { expiresIn: Math.floor(cfg.jwt.accessExpiresInMs / 1000) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    CsrfGuard,
    // Global guards live here so their dependencies (JwtService, repositories) resolve in this module.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
