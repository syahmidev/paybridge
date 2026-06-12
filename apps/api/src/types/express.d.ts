// Request context attached by the auth middlewares.
declare global {
  namespace Express {
    interface Request {
      merchantId?: string;
      apiKeyId?: string;
    }
  }
}

export {};
