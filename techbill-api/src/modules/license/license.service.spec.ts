import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from './license.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenseStatus, DeviceStatus, LicenseType, DesktopPlan } from '@prisma/client';

// ─── Minimal Prisma mock ─────────────────────────────────────────────────────

const mockLicense = {
  id: 'lic-uuid-1',
  userId: 'user-uuid-1',
  issuedBy: 'admin-uuid-1',
  licenseKey: 'TB-DSK-AAAA-BBBB-CCCC',
  licenseType: LicenseType.DESKTOP,
  plan: DesktopPlan.BASIC,
  status: LicenseStatus.ACTIVE,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year ahead
  maxDevices: 1,
  signedToken: 'mocked-token',
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser = {
  id: 'user-uuid-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hashed',
  role: 'owner',
  isActive: true,
  tenantId: 'tenant-uuid-1',
  permissions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  userPermission: {
    id: 'perm-uuid-1',
    userId: 'user-uuid-1',
    webAccess: true,
    desktopAccess: true,
    mobileAccess: false,
    updatedAt: new Date(),
  },
};

const mockDevice = {
  id: 'device-uuid-1',
  licenseId: 'lic-uuid-1',
  userId: 'user-uuid-1',
  deviceName: "Test Shop PC",
  deviceType: 'desktop',
  os: 'Windows 11',
  machineHash: 'abc123hash',
  hardwareId: 'hw-id-001',
  lastLoginAt: new Date(),
  lastCheckinAt: null,
  appVersion: '1.0.0',
  status: DeviceStatus.ACTIVE,
  createdAt: new Date(),
};

const prismaMock = {
  user: {
    findUnique: jest.fn().mockResolvedValue(mockUser),
    create: jest.fn().mockResolvedValue(mockUser),
    update: jest.fn().mockResolvedValue(mockUser),
    findMany: jest.fn().mockResolvedValue([mockUser]),
  },
  tenant: {
    findUnique: jest.fn().mockResolvedValue({ id: 'tenant-uuid-1', name: 'Test Shop', slug: 'testshop' }),
  },
  license: {
    findUnique: jest.fn().mockResolvedValue(mockLicense),
    findMany: jest.fn().mockResolvedValue([mockLicense]),
    create: jest.fn().mockResolvedValue(mockLicense),
    update: jest.fn().mockResolvedValue(mockLicense),
  },
  device: {
    findFirst: jest.fn().mockResolvedValue(mockDevice),
    create: jest.fn().mockResolvedValue(mockDevice),
    update: jest.fn().mockResolvedValue(mockDevice),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  userPermission: {
    upsert: jest.fn().mockResolvedValue({
      userId: 'user-uuid-1',
      webAccess: true,
      desktopAccess: true,
      mobileAccess: false,
      updatedAt: new Date(),
    }),
  },
};

const configMock = {
  get: jest.fn((key: string) => {
    if (key === 'LICENSE_SIGNING_PRIVATE_KEY') {
      // 32 random bytes as hex — valid Ed25519 private key for testing
      return 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
    }
    return undefined;
  }),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LicenseService', () => {
  let service: LicenseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<LicenseService>(LicenseService);
    jest.clearAllMocks();
  });

  // ── createLicense ──────────────────────────────────────────────────────────

  describe('createLicense', () => {
    it('issues a new license when user has desktop access', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.license.findUnique.mockResolvedValue(null); // no collision
      prismaMock.license.create.mockResolvedValue(mockLicense);

      const result = await service.createLicense(
        {
          userId: 'user-uuid-1',
          licenseType: LicenseType.DESKTOP,
          plan: DesktopPlan.BASIC,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        },
        'admin-uuid-1',
      );

      expect(prismaMock.license.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(LicenseStatus.ACTIVE);
    });

    it('throws ForbiddenException when desktopAccess is false', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        userPermission: { ...mockUser.userPermission, desktopAccess: false },
      });

      await expect(
        service.createLicense(
          {
            userId: 'user-uuid-1',
            licenseType: LicenseType.DESKTOP,
            plan: DesktopPlan.BASIC,
            expiresAt: new Date().toISOString(),
          },
          'admin-uuid-1',
        ),
      ).rejects.toThrow('desktop_access');
    });

    it('throws NotFoundException when user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createLicense(
          {
            userId: 'nonexistent',
            licenseType: LicenseType.DESKTOP,
            plan: DesktopPlan.BASIC,
            expiresAt: new Date().toISOString(),
          },
          'admin-uuid-1',
        ),
      ).rejects.toThrow('User not found');
    });
  });

  // ── revokeLicense ──────────────────────────────────────────────────────────

  describe('revokeLicense', () => {
    it('sets status to REVOKED', async () => {
      prismaMock.license.findUnique.mockResolvedValue(mockLicense);
      prismaMock.license.update.mockResolvedValue({
        id: 'lic-uuid-1',
        status: LicenseStatus.REVOKED,
      });

      const result = await service.revokeLicense('lic-uuid-1');
      expect(result.status).toBe(LicenseStatus.REVOKED);
    });

    it('throws NotFoundException for unknown license id', async () => {
      prismaMock.license.findUnique.mockResolvedValue(null);

      await expect(service.revokeLicense('bad-id')).rejects.toThrow(
        'bad-id',
      );
    });
  });

  // ── activateLicense ────────────────────────────────────────────────────────

  describe('activateLicense', () => {
    const activateDto = {
      licenseKey: 'TB-DSK-AAAA-BBBB-CCCC',
      machineHash: 'new-machine-hash',
      hardwareId: 'hw-002',
      os: 'Windows 11',
      appVersion: '1.0.0',
      deviceName: "New Shop PC",
    };

    it('registers a new device and returns signed token', async () => {
      // Return license with 0 active devices (so we can add one)
      prismaMock.license.findUnique.mockResolvedValue({
        ...mockLicense,
        user: mockUser,
        devices: [],
      });
      prismaMock.device.create.mockResolvedValue(mockDevice);
      prismaMock.license.update.mockResolvedValue(mockLicense);

      const result = await service.activateLicense(activateDto);

      expect(prismaMock.device.create).toHaveBeenCalledTimes(1);
      expect(result.signedToken).toBe('mocked-token');
    });

    it('blocks activation when device limit is reached', async () => {
      // BASIC plan = 1 device; already has 1 device with a different machineHash
      prismaMock.license.findUnique.mockResolvedValue({
        ...mockLicense, // maxDevices: 1
        user: mockUser,
        devices: [{ ...mockDevice, machineHash: 'different-hash' }],
      });

      await expect(service.activateLicense(activateDto)).rejects.toThrow(
        'Device limit reached',
      );
    });

    it('blocks activation when license is revoked', async () => {
      prismaMock.license.findUnique.mockResolvedValue({
        ...mockLicense,
        status: LicenseStatus.REVOKED,
        user: mockUser,
        devices: [],
      });

      await expect(service.activateLicense(activateDto)).rejects.toThrow(
        'revoked',
      );
    });

    it('blocks activation when license is expired', async () => {
      prismaMock.license.findUnique.mockResolvedValue({
        ...mockLicense,
        expiresAt: new Date(Date.now() - 1000), // in the past
        user: mockUser,
        devices: [],
      });

      await expect(service.activateLicense(activateDto)).rejects.toThrow(
        'expired',
      );
    });

    it('throws NotFoundException for unknown license key', async () => {
      prismaMock.license.findUnique.mockResolvedValue(null);

      await expect(service.activateLicense(activateDto)).rejects.toThrow(
        'License key not found',
      );
    });
  });

  // ── checkin ────────────────────────────────────────────────────────────────

  describe('checkin', () => {
    const checkinDto = {
      licenseKey: 'TB-DSK-AAAA-BBBB-CCCC',
      machineHash: 'abc123hash',
      appVersion: '1.0.1',
    };

    it('updates device checkin timestamp and returns current status', async () => {
      prismaMock.license.findUnique.mockResolvedValue(mockLicense);
      prismaMock.device.findFirst.mockResolvedValue(mockDevice);
      prismaMock.device.update.mockResolvedValue(mockDevice);
      prismaMock.license.update.mockResolvedValue(mockLicense);

      const result = await service.checkin(checkinDto);

      expect(result.status).toBe(LicenseStatus.ACTIVE);
      expect(result.serverTimestamp).toBeDefined();
      expect(result.signedToken).toBe('mocked-token');
    });

    it('rejects checkin for unregistered device', async () => {
      prismaMock.license.findUnique.mockResolvedValue(mockLicense);
      prismaMock.device.findFirst.mockResolvedValue(null);

      await expect(service.checkin(checkinDto)).rejects.toThrow(
        'Device not registered',
      );
    });
  });

  // ── setUserPermissions ─────────────────────────────────────────────────────

  describe('setUserPermissions', () => {
    it('upserts user permission toggles', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.setUserPermissions('user-uuid-1', {
        webAccess: true,
        desktopAccess: true,
        mobileAccess: false,
      });

      expect(prismaMock.userPermission.upsert).toHaveBeenCalledTimes(1);
      expect(result.desktopAccess).toBe(true);
    });
  });

  // ── listAllUsers / adminCreateUser / adminUpdateUser ──────────────────────────

  describe('admin user administration', () => {
    it('lists all users across tenants', async () => {
      prismaMock.user.findMany.mockResolvedValue([mockUser]);
      const result = await service.listAllUsers();
      expect(prismaMock.user.findMany).toHaveBeenCalled();
      expect(result.length).toBe(1);
    });

    it('creates a user under a specific tenant', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-uuid-1', name: 'Test Shop', slug: 'testshop' });
      prismaMock.user.findUnique.mockResolvedValue(null); // No collision on email username@testshop.techbill.app
      prismaMock.user.create.mockResolvedValue(mockUser);

      const result = await service.adminCreateUser({
        name: 'New User',
        username: 'newuser',
        password: 'password123',
        role: 'cashier',
        tenantId: 'tenant-uuid-1',
      });

      expect(prismaMock.user.create).toHaveBeenCalled();
      expect(result.name).toBe('Test User'); // returns mocked user
    });

    it('updates user parameters as admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const result = await service.adminUpdateUser('user-uuid-1', {
        name: 'Updated Name',
        role: 'inventory_manager',
      });

      expect(prismaMock.user.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });
  });
});

