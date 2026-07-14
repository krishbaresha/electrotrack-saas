import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { FeaturesService } from '../../modules/features/features.service';
import { TenantStatus } from '@prisma/client';

@Injectable()
export class TenantActiveGuard implements CanActivate {
  constructor(private featuresService: FeaturesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Only block mutating requests (POST, PUT, PATCH, DELETE)
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(request.method)) {
      return true; // Allow GET requests
    }

    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId) {
      return true; // Pass through if no tenant ID is present (might be system/admin route)
    }

    const license = await this.featuresService.getResolvedLicense(tenantId as string);

    if (license.status !== TenantStatus.ACTIVE && license.status !== TenantStatus.TRIAL) {
      throw new ForbiddenException(`Subscription inactive. Current status: ${license.status}`);
    }

    if (license.isExpired) {
      throw new ForbiddenException('Subscription has expired.');
    }

    return true;
  }
}
