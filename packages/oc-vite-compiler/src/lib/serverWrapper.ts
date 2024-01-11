const removeExtension = (path: string) => path.replace(/\.(j|t)sx?$/, '');

export type ServerWrapper = (options: {
  exports: string[];
  serverPath: string;
  componentName: string;
  componentVersion: string;
  bundleHashKey: string;
}) => string;

const higherOrderServerTemplate: ServerWrapper = ({
  exports,
  serverPath,
  componentName,
  componentVersion,
  bundleHashKey,
}) => {
  return `
${
  exports.includes('server')
    ? `import { server } from '${removeExtension(serverPath)}'
       const dataProvider = server.getData();`
    : `import { data as dataProvider } from '${removeExtension(serverPath)}'`
}

export const data = (context : any, callback : (error: any, data?: any) => void) => {
  dataProvider(context, (error: any, model: any) => {
    if (error) {
      return callback(error);
    }
    if (model == null) return callback(null, { __oc_emptyResponse: true });
    const props = Object.assign({}, model, {
      _staticPath: context.staticPath,
      _baseUrl: context.baseUrl,
      _componentName: "${componentName}",
      _componentVersion: "${componentVersion}"
    });
    const srcPathHasProtocol = context.staticPath.indexOf("http") === 0;
    const srcPath = srcPathHasProtocol ? context.staticPath : ("https:" + context.staticPath);
    return callback(null, Object.assign({}, {
      component: {
        key: "${bundleHashKey}",
        src: srcPath + "template.js",
        props
      }
    }));
  });
}
`;
};

export default higherOrderServerTemplate;
