declare namespace Express {
  interface Request {
    file?: { originalname: string; buffer: Buffer; mimetype: string; size: number };
  }
}

declare module 'multer' {
  import type { RequestHandler } from 'express';
  interface Options {
    storage?: unknown;
    limits?: { fileSize?: number; files?: number };
  }
  interface Instance {
    single(fieldName: string): RequestHandler;
  }
  function multer(options?: Options): Instance;
  namespace multer {
    function memoryStorage(): unknown;
  }
  export = multer;
}
