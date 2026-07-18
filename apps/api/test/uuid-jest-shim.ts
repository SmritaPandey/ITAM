// Jest CJS shim for the ESM-only `uuid` v14 package. Only v4 is used in src.
import { randomUUID } from 'crypto';

export const v4 = (): string => randomUUID();
export default { v4 };
