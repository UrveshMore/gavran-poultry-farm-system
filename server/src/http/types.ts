import type { FarmAccess } from '../modules/farms/access.js';
import type { AuthUser } from '../modules/auth/types.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authUser?: AuthUser;
      farmAccess?: FarmAccess;
    }
  }
}

export {};
