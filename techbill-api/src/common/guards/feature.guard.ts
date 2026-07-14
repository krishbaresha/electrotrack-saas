import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeaturesService } from '../../modules/features/features.service';
import { REQUIRE_FEATURE_KEY, RequiredFeatureMetadata } from '../decorators/require-feature.decorator';
import { FeatureAccess } from '@prisma/client';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featuresService: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<RequiredFeatureMetadata>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Platform Super Admin bypasses feature checks
    if (!user || !user.tenantId) {
      return true;
    }

    const license = await this.featuresService.getUserLicense(user.tenantId, user.role, user.permissions || []);
    const resolvedAccess = license.features[requiredFeature.featureKey] || FeatureAccess.NONE;

    if (resolvedAccess === FeatureAccess.NONE) {
      throw new ForbiddenException(`Feature "${requiredFeature.featureKey}" is disabled for this tenant`);
    }

    // Access level hierarchy check
    // FULL > WRITE > READ > NONE
    const accessLevels = {
      [FeatureAccess.NONE]: 0,
      [FeatureAccess.READ]: 1,
      [FeatureAccess.WRITE]: 2,
      [FeatureAccess.FULL]: 3,
    };

    if (accessLevels[resolvedAccess] < accessLevels[requiredFeature.requiredAccess]) {
      throw new ForbiddenException(
        `Insufficient access level for feature "${requiredFeature.featureKey}". Required: ${requiredFeature.requiredAccess}, Resolved: ${resolvedAccess}`
      );
    }

    return true;
  }
}
