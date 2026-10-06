import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createOperatorServer } from './factory.js';

await serveStdio(createOperatorServer);
