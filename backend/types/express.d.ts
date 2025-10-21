// backend/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    // English: ID of the authenticated user, extracted from JWT
    userId?: string;
  }
}
