import 'express-session';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        profileImageUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    identityId?: string;
  }
}
