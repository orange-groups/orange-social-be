import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionController } from './auth-session.controller';
import { AuthSessionService } from './auth-session.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TrustedOriginGuard } from '../../common/guards/trusted-origin.guard';
import { UserSessionRepository } from './repositories/user-session.repository';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';

@Module({
  imports: [ConfigModule, DatabaseModule, JwtModule.register({})],
  controllers: [
    AuthController,
    AuthSessionController,
    PasswordRecoveryController,
  ],
  providers: [
    AuthService,
    AuthSessionService,
    UserSessionRepository,
    JwtAuthGuard,
    TrustedOriginGuard,
    PasswordRecoveryService,
  ],
  // Other modules: import AuthModule, then @UseGuards(JwtAuthGuard)
  exports: [AuthService, AuthSessionService, JwtAuthGuard],
})
export class AuthModule {}
