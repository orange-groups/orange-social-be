import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionController } from './auth-session.controller';
import { AuthSessionService } from './auth-session.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TrustedOriginGuard } from './guards/trusted-origin.guard';
import { UserSessionRepository } from './repositories/user-session.repository';

@Module({
  imports: [ConfigModule, DatabaseModule, JwtModule.register({})],
  controllers: [AuthController, AuthSessionController],
  providers: [
    AuthService,
    AuthSessionService,
    UserSessionRepository,
    JwtAuthGuard,
    TrustedOriginGuard,
  ],
  // Other modules: import AuthModule, then @UseGuards(JwtAuthGuard)
  exports: [AuthService, AuthSessionService, JwtAuthGuard],
})
export class AuthModule {}
