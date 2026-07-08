import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

const ALL_PERMISSIONS = [
  'pos.read', 'pos.sell', 'pos.discount', 'pos.void', 'pos.online_sell',
  'inventory.read', 'inventory.write', 'inventory.delete',
  'suppliers.read', 'suppliers.write',
  'customers.read', 'customers.write',
  'returns.read', 'returns.create', 'returns.review',
  'reports.read', 'reports.cash_reconciliation',
  'users.read', 'users.manage', 'users.permissions',
  'settings.read', 'settings.manage',
  'audit.read', 'notifications.read', 'notifications.manage',
  'warranty.read', 'loyalty.read', 'loyalty.manage'
];

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
  }

  async createTenant(dto: {
    name: string;
    username: string;
    plan?: string;
    maxUsers?: number;
    ownerName: string;
    ownerPasswordHashOrText: string;
  }) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const ownerEmail = `${dto.username}@${slug}.techbill.app`;

    // 1. Check if tenant slug or owner email already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug }
    });
    if (existingTenant) {
      throw new ConflictException(`Tenant slug "${slug}" is already in use`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: ownerEmail }
    });
    if (existingUser) {
      throw new ConflictException(`Email "${ownerEmail}" is already in use`);
    }

    const passwordHash = await bcrypt.hash(dto.ownerPasswordHashOrText, BCRYPT_ROUNDS);

    // Create tenant, initial owner user, and default shop settings inside a transaction
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          plan: dto.plan || 'trial',
          maxUsers: dto.maxUsers || 5,
        }
      });

      const owner = await tx.user.create({
        data: {
          name: dto.ownerName,
          email: ownerEmail,
          passwordHash,
          role: Role.owner,
          tenantId: tenant.id,
          permissions: ALL_PERMISSIONS,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true
        }
      });

      // Seed default shop settings for the new tenant
      await tx.shopSettings.create({
        data: {
          tenantId: tenant.id,
          shopName: dto.name,
          maxDiscountWithoutOtp: 500,
        }
      });

      return { tenant, owner };
    });
  }

  async updateTenant(
    id: string,
    dto: {
      status?: string;
      plan?: string;
      maxUsers?: number;
      onlineSellingEnabled?: boolean;
    }
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    return this.prisma.tenant.update({
      where: { id },
      data: dto
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true
          }
        }
      }
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }
    return tenant;
  }

  async deleteTenant(id: string, force: boolean) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    if (force) {
      return this.prisma.tenant.delete({ where: { id } });
    } else {
      return this.prisma.tenant.update({
        where: { id },
        data: { status: 'pending_deletion' },
      });
    }
  }

  async restoreTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async renewTenant(id: string, startDate?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const base = startDate ? new Date(startDate) : new Date();
    const newPeriodEnd = new Date(base);
    newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

    return this.prisma.tenant.update({
      where: { id },
      data: {
        currentPeriodEnd: newPeriodEnd,
        // If tenant was suspended, reactivate on renewal
        ...(tenant.status === 'suspended' ? { status: 'active' } : {}),
      },
    });
  }

  private readonly logger = new Logger(TenantsService.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanupPendingDeletions() {
    this.logger.log('Running daily cleanup for pending_deletion tenants...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tenantsToDelete = await this.prisma.tenant.findMany({
      where: {
        status: 'pending_deletion',
        updatedAt: { lte: thirtyDaysAgo },
      },
    });

    for (const tenant of tenantsToDelete) {
      try {
        await this.prisma.tenant.delete({ where: { id: tenant.id } });
        this.logger.log(`Hard deleted tenant ${tenant.id} (${tenant.name})`);
      } catch (err) {
        this.logger.error(`Failed to delete tenant ${tenant.id}`, err);
      }
    }
  }
}
