/// <reference types="vite/client" />

import 'vite'

declare module 'vite' {
  interface ServerOptions {
    allowedHosts?: boolean | true | string[];
  }
}
