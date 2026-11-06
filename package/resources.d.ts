export interface ExportResourcesOptions {
  /** Destination file outside the public directory. */
  htmlFile: string;
  /** Dedicated directory served at /maputnik/. */
  publicDir: string;
}

export interface ExportResourcesResult {
  htmlFile: string;
  publicDir: string;
  /** Relative paths of copied public resources and licenses; never HTML. */
  files: string[];
}

export function exportResources(options: ExportResourcesOptions): Promise<ExportResourcesResult>;
