import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private mailer: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private eventEmitter: EventEmitter2,
  ) {
    this.mailer = nodemailer.createTransport({
      host: configService.get('SMTP_HOST'),
      port: parseInt(configService.get('SMTP_PORT', '465')),
      secure: configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: configService.get('SMTP_USER'),
        pass: configService.get('SMTP_PASS'),
      },
    });
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const isMobile = dto.clientSource === 'mobile';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
            plan: true,
            slug: true,
            onlineSellingEnabled: true,
            appAccessEnabled: true,
            isWarehouseEnabled: true,
            subscriptionExpiresAt: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      this.eventEmitter.emit('user.failed_login', {
        email: dto.email,
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Block suspended/cancelled tenant
    if (user.tenant && user.tenant.status !== 'active') {
      throw new UnauthorizedException(
        'Your shop account has been suspended. Contact platform admin.',
      );
    }

    // Block mobile app login if tenant does not have app access
    if (isMobile && user.role !== Role.platform_admin) {
      if (!user.tenant || !user.tenant.appAccessEnabled) {
        throw new UnauthorizedException(
          "You don't have an app subscription. Please contact the platform admin.",
        );
      }
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.eventEmitter.emit('user.failed_login', {
        email: dto.email,
        ipAddress,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      permissions: user.permissions,
      // Tag mobile sessions in the JWT so downstream services can identify origin
      ...(isMobile ? { clientSource: 'mobile' } : {}),
    };

    // Mobile clients receive long-term / "permanent" tokens (10 years)
    // to avoid forcing re-login in offline-capable WhatsApp-mode sessions.
    const accessTokenExpiry = isMobile
      ? '3650d'
      : this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshTokenExpiry = isMobile
      ? '3650d'
      : this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d');

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: refreshTokenExpiry,
    });

    // Persist refresh token — mobile sessions expire in 10 years
    const expiresAt = new Date();
    if (isMobile) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
        ipAddress: ipAddress ?? null,
      },
    });

    this.eventEmitter.emit('user.login', { userId: user.id, ipAddress });

    // Determine effective warehouse access (gated by subscription expiry)
    const now = new Date();
    const warehouseEnabled =
      (user.tenant?.isWarehouseEnabled ?? false) &&
      (!user.tenant?.subscriptionExpiresAt ||
        user.tenant.subscriptionExpiresAt > now);

    return {
      accessToken,
      refreshToken,
      subdomain: user.tenant?.slug ?? null,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name ?? null,
        currentPlan: user.tenant?.plan ?? 'starter',
        permissions: user.permissions,
        subdomain: user.tenant?.slug ?? null,
        onlineSellingEnabled: user.tenant?.onlineSellingEnabled ?? false,
        currentPeriodEnd: user.tenant?.currentPeriodEnd ?? null,
        isWarehouseEnabled: warehouseEnabled,
      },
    };
  }

  async refresh(refreshToken: string, ipAddress?: string) {
    let payload: {
      sub: string;
      email: string;
      role: string;
      tenantId: string | null;
      permissions: string[];
      clientSource?: string;
    };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });

    // Reload user to get fresh permissions/tenant status
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: {
          select: {
            status: true,
            onlineSellingEnabled: true,
            currentPeriodEnd: true,
            isWarehouseEnabled: true,
            subscriptionExpiresAt: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    if (user.tenant && user.tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant suspended');
    }

    // Preserve mobile session origin from the original payload claim
    const isMobile = payload.clientSource === 'mobile';

    const newPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      permissions: user.permissions,
      ...(isMobile ? { clientSource: 'mobile' } : {}),
    };

    const accessTokenExpiry = isMobile
      ? '3650d'
      : this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshTokenExpiry = isMobile
      ? '3650d'
      : this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d');

    const newAccessToken = this.jwtService.sign(newPayload, {
      expiresIn: accessTokenExpiry,
    });
    const newRefreshToken = this.jwtService.sign(
      { ...newPayload, jti: crypto.randomUUID() },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: refreshTokenExpiry,
      },
    );

    // Mobile sessions expire in 10 years, web sessions in 7 days
    const expiresAt = new Date();
    if (isMobile) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: payload.sub,
        expiresAt,
        ipAddress: ipAddress ?? null,
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive)
      throw new BadRequestException('User not found');

    const code = await this.otpService.generate(userId);
    const ttl = this.configService.get('OTP_TTL_SECONDS', '300');

    // Dev bypass: set OTP_LOG_TO_CONSOLE=true in .env to skip email during development
    if (this.configService.get('OTP_LOG_TO_CONSOLE') === 'true') {
      console.log(`[DEV OTP] ${user.email} → ${code} (valid ${ttl}s)`);
      return;
    }

    try {
      await this.mailer.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: user.email,
        subject: 'TechBill — Your OTP Code',
        text: `Your OTP is: ${code}\n\nValid for ${ttl} seconds. Do not share this code.`,
        html: `<p>Your OTP is: <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>Valid for ${ttl} seconds.</p>`,
      });
    } catch {
      // Invalidate the generated OTP so it doesn't persist without delivery
      await this.otpService.invalidate(userId);
      throw new BadRequestException('Failed to send OTP — please try again');
    }
  }

  async verifyOtp(userId: string, code: string) {
    const valid = await this.otpService.verify(userId, code);
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      otp: true,
    };
    const otpToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_OTP_EXPIRES_IN', '2m'),
    });

    return { otpToken };
  }

  // ─── Password Reset (admin/owner self-reset via OTP) ──────────────────────

  async requestPasswordReset(email: string) {
    // Always return generic message to prevent enumeration
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Only platform_admin and owner can self-reset
    if (
      user &&
      user.isActive &&
      (user.role === Role.platform_admin || user.role === Role.owner)
    ) {
      const code = await this.otpService.generate(user.id);
      try {
        await this.mailer.sendMail({
          from: this.configService.get('SMTP_FROM'),
          to: user.email,
          subject: 'TechBill Password Reset',
          text: `Your password reset OTP is: ${code}. Valid for ${this.configService.get('OTP_TTL_SECONDS', '300')} seconds.`,
        });
      } catch {
        // Silently fail — don't reveal email delivery status
      }
    }

    return {
      message: 'If this account can reset password, an OTP has been sent.',
    };
  }

  async confirmPasswordReset(email: string, otp: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid reset request');
    }

    // Only platform_admin and owner can self-reset
    if (user.role !== Role.platform_admin && user.role !== Role.owner) {
      throw new ForbiddenException(
        'Workers cannot reset their own password. Contact your admin.',
      );
    }

    const valid = await this.otpService.verify(user.id, otp);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const rounds = parseInt(this.configService.get('BCRYPT_ROUNDS', '12'));
    const hash = await bcrypt.hash(newPassword, rounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });

    return { message: 'Password reset successful' };
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.passwordHash) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      appAccessEnabled: user.tenant?.appAccessEnabled ?? false,
      status: user.isActive ? 'active' : 'inactive',
      currentPeriodEnd: user.tenant?.currentPeriodEnd?.toISOString() ?? null,
      tenant: user.tenant
        ? {
            onlineSellingEnabled: user.tenant.onlineSellingEnabled,
            businessName: user.tenant.name,
          }
        : null,
    };
  }
}
