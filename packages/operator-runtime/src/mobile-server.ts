import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMobileOperatorServer } from './mobile-factory.js';

await serveStdio(createMobileOperatorServer);
