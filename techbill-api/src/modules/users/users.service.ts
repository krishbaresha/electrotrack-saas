import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createUser(dto: CreateUserDto, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const email = `${dto.username}@${tenant.slug}.techbill.app`;

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) throw new ConflictException(`Email ${email} already in use`);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash,
        role: dto.role,
        tenantId,
        isActive: true,
        permissions: dto.permissions || [],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
      },
    });
  }

  async updateUser(id: string, dto: UpdateUserDto, tenantId: string) {
    const user = await this.findOrThrow(id, tenantId);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.permissions !== undefined) data.permissions = dto.permissions;
    if (dto.password)
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
      },
    });

    this.eventEmitter.emit('subscription.updated', { tenantId });

    return updated;
  }

  async resetPassword(id: string, newPassword: string, tenantId: string) {
    const user = await this.findOrThrow(id, tenantId);

    if (user.role === 'owner') {
      throw new ForbiddenException(
        'Cannot reset the password of the shop owner/admin.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Password updated successfully' };
  }

  async deleteUser(id: string, tenantId: string) {
    const user = await this.findOrThrow(id, tenantId);
    if (user.role === 'owner') {
      throw new ForbiddenException('Cannot deactivate the shop owner/admin.');
    }
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { message: 'User deactivated' };
  }

  async getUserActivity(id: string, tenantId: string) {
    await this.findOrThrow(id, tenantId);
    const [recentSales, recentReturns] = await Promise.all([
      this.prisma.sale.findMany({
        where: { soldById: id, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          createdAt: true,
          status: true,
        },
      }),
      this.prisma.return.findMany({
        where: { requestedById: id, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, status: true, createdAt: true, reason: true },
      }),
    ]);
    return { recentSales, recentReturns };
  }

  private async findOrThrow(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) throw new NotFoundException(`User ${id} not found in this shop`);
    return user;
  }
}
