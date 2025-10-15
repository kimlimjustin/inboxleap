import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import dotenv from "dotenv";
import pg from "pg";
import { getOrCreateUserByEmail } from "./services/userService.js";

dotenv.config();

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("Environment variable GOOGLE_CLIENT_ID not provided");
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Environment variable GOOGLE_CLIENT_SECRET not provided");
}

if (!process.env.APP_URL) {
  throw new Error("Environment variable APP_URL not provided");
}

interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

export function getSession(): RequestHandler {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  let sessionStore;
  
  if (process.env.NODE_ENV === "production") {
    // Use PostgreSQL store in production
    const pgStore = connectPg(session);
    
    // Create pg pool with SSL configuration for Aiven
    const pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    sessionStore = new pgStore({
      pool: pgPool,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    // Use memory store in development to avoid SSL issues
    const MemStore = MemoryStore(session);
    sessionStore = new MemStore({
      checkPeriod: sessionTtl, // prune expired entries every 24h
    });
  }
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(profile: GoogleUser) {
  const { signUpOrSignInUser } = await import('./services/userService');
  return await signUpOrSignInUser(profile.email, {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileImageUrl: profile.profileImageUrl,
    authProvider: 'google'
  });
}

function generateGoogleOAuthUrl(): string {
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'profile email',
    access_type: 'offline',
    prompt: 'consent'
  });
  
  return `${baseUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
    grant_type: 'authorization_code',
    code: code
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchGoogleProfile(accessToken: string) {
  const profileUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
  
  const response = await fetch(profileUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Profile fetch failed: ${response.statusText}`);
  }

  return await response.json();
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Google OAuth initiation
  app.get("/api/auth/google", (req, res) => {
    console.log("Initiating Google OAuth flow...");
    const authUrl = generateGoogleOAuthUrl();
    res.redirect(authUrl);
  });

  // Google OAuth callback
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      console.log("Google OAuth callback received with code:", !!code);

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Authorization code not provided" });
      }

      // Exchange code for tokens
      console.log("Debug OAuth params:", {
        client_id: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + "...",
        redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
        has_client_secret: !!process.env.GOOGLE_CLIENT_SECRET
      });
      const tokens = await exchangeCodeForTokens(code);
      console.log("Tokens received:", { access_token: !!tokens.access_token });

      // Fetch user profile
      const profile = await fetchGoogleProfile(tokens.access_token);
      console.log("Profile received:", {
        id: profile.id,
        email: profile.email,
        name: profile.name
      });

      // Get or create user with consistent ID handling
      const user = await getOrCreateUserByEmail(profile.email, {
        id: profile.id,
        firstName: profile.given_name || '',
        lastName: profile.family_name || '',
        profileImageUrl: profile.picture || null,
      });

      // Initialize or get identity for user
      const { identityService } = await import('./services/identityService');
      let userIdentity = await identityService.getUserIdentity(user.id);

      if (!userIdentity) {
        // Create personal identity if it doesn't exist
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
        userIdentity = await identityService.createUserIdentity(user.id, displayName);
        console.log(`✅ [GOOGLE-AUTH] Created personal identity ${userIdentity.id} for user ${user.id}`);
      }

      // Store user and identity in session
      (req.session as any).user = user;
      (req.session as any).identityId = userIdentity.id;

      console.log("Google OAuth authentication successful, redirecting to dashboard");
      res.redirect("/dashboard");
    } catch (error) {
      console.error("Google OAuth error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // User info endpoint
  app.get("/api/auth/user", (req, res) => {
    const user = (req.session as any).user;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Logout endpoint
  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = (req.session as any).user;
  if (user) {
    // Add user to request object for consistency
    (req as any).user = user;

    // Auto-initialize identity if missing (for existing sessions)
    if (!(req.session as any).identityId) {
      try {
        const { identityService } = await import('./services/identityService');
        let userIdentity = await identityService.getUserIdentity(user.id);

        if (!userIdentity) {
          // Create personal identity if it doesn't exist
          const displayName = user.name || user.email;
          userIdentity = await identityService.createUserIdentity(user.id, displayName);
          console.log(`✅ [AUTH] Auto-created personal identity ${userIdentity.id} for user ${user.id}`);
        }

        if (userIdentity) {
          // Set identity in session
          (req.session as any).identityId = userIdentity.id;
          console.log(`🔄 [AUTH] Auto-initialized identityId ${userIdentity.id} for user ${user.id}`);

          // Save session to ensure identityId is persisted
          await new Promise<void>((resolve, reject) => {
            req.session.save((err: any) => {
              if (err) {
                console.error('❌ [AUTH] Error saving session:', err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }
      } catch (error) {
        console.error('❌ [AUTH] Error auto-initializing identity:', error);
        // Continue anyway - don't block the request
      }
    }

    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
