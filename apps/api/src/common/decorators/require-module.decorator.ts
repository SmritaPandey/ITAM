import { SetMetadata } from '@nestjs/common';
import { ModuleKey } from '../utils/modules';

export const REQUIRE_MODULE_KEY = 'require_module';
export const RequireModule = (moduleKey: ModuleKey) => SetMetadata(REQUIRE_MODULE_KEY, moduleKey);
