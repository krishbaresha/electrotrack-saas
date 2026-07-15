import { SetMetadata } from '@nestjs/common';
import { FeatureAccess } from '@prisma/client';

export const REQUIRE_FEATURE_KEY = 'require_feature';

export interface RequiredFeatureMetadata {
  featureKey: string;
  requiredAccess: FeatureAccess;
}

export const RequireFeature = (
  featureKey: string,
  requiredAccess: FeatureAccess = FeatureAccess.READ,
) => SetMetadata(REQUIRE_FEATURE_KEY, { featureKey, requiredAccess });
