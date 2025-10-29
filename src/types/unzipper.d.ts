// Tipos mínimos para lo que usamos de 'unzipper'
declare module "unzipper" {
  import { Readable } from "stream";

  export interface Entry {
    path: string;
    buffer(): Promise<Buffer>;
    stream(): Readable;
    autodrain(): Readable;
  }

  export interface Directory {
    files: Entry[];
  }

  export const Open: {
    file(path: string): Promise<Directory>;
    buffer?(buf: Buffer): Promise<Directory>;
  };
}
