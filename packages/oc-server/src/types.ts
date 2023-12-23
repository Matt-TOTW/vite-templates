interface OC {
  conf: {
    templates: Array<{
      type: string;
      externals: string[];
    }>;
  };
  cmd: {
    push: (cb: (oc: OC) => void) => void;
  };
  events: {
    on: (eventName: string, fn: (...data: any[]) => void) => void;
    off: (eventName: string, fn?: (...data: any[]) => void) => void;
    fire: (eventName: string, data?: any) => void;
    reset: () => void;
  };
  renderNestedComponent: (ocElement: HTMLElement, cb: () => void) => void;
}

export interface AcceptLanguage {
  code: string;
  script?: any;
  region: string;
  quality: number;
}

export interface Env {
  name: string;
}

export interface Plugins {}

export interface External {
  global: string;
  url: string;
  name: string;
}

export interface Template {
  type: string;
  version: string;
  externals: External[];
}

export interface Context<T = any, E = Env> {
  action?: string;
  acceptLanguage: AcceptLanguage[];
  baseUrl: string;
  env: E;
  params: T;
  plugins: Plugins;
  requestHeaders: Record<string, string>;
  requestIp: string;
  setEmptyResponse: () => void;
  setHeader: (header: string, value: string) => void;
  staticPath: string;
  templates: Template[];
}

type Callback<D, E = Error> = (error: E | null, data?: D) => void;

export type DataProvider<Parameters = any, Return = any, Environment = Env> = (
  context: Context<Parameters, Environment>,
  callback: Callback<Return>
) => void;
