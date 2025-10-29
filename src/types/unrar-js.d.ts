// Tipos mínimos para lo que usamos de 'unrar-js'
declare module "unrar-js" {
  export interface FileHeader {
    name: string;
  }
  export interface FileList {
    fileHeaders: FileHeader[];
  }
  export interface ExtractedFile {
    fileHeader: FileHeader;
    extracted: Uint8Array;
  }
  export interface ExtractResult {
    files: ExtractedFile[];
  }

  export interface Extractor {
    getFileList(): FileList;
    extract(opts: { files?: string[] }): ExtractResult;
  }

  export function createExtractorFromData(opts: {
    data: Uint8Array;
  }): Promise<Extractor>;
}
