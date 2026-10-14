process.env.NODE_ENV = 'production';
process.env.SERVE_CLIENT = 'true';
await import('./dist/index.js');
