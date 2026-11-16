import escapeCSS from 'cssesc';

export interface HtmlTemplate {
  templateId: string;
  templateName: string;
  css: string;
  externals: Array<{
    name: string;
    global: string;
  }>;
  hash: string;
  bundle: string;
}

export default function htmlTemplate({
  templateId,
  templateName,
  externals,
  css,
  bundle,
  hash,
}: HtmlTemplate) {
  // Retain model.element only until the generated script can capture its
  // mount node. A document-level lookup cannot cross a shadow boundary.
  return `function(model){
  oc.${templateName}Components = oc.${templateName}Components || {};
  oc.${templateName}Components['${hash}'] = (${bundle});
  if (!model) return;
  var modelHTML =  model.__html ? model.__html : '';
  var ssr = !!modelHTML;
  var externals = ${JSON.stringify(externals)};
  var staticPath = model.component.props._staticPath;
  if (ssr) {
    externals.push({
      global: ['oc', 'components', '${hash}'],
      url: staticPath + 'template.js',
      name: "template"
    });
  }
  var props = JSON.stringify(model.component.props);
  oc = oc || {};
  oc.__${templateName}Template = oc.__${templateName}Template || { count: 0 };
  oc.__data = oc.__data || {};
  oc.__data[model.id] = model.component.props;
  var count = oc.__${templateName}Template.count;
  var templateId = "${templateId}-" + count;
  oc.__${templateName}Template.count++;
  if (model.element) {
    oc.__${templateName}Template.elements = oc.__${templateName}Template.elements || {};
    oc.__${templateName}Template.elements[templateId] = model.element;
  }
  var ssrCall = 'oc.components["${hash}"]({ id: "' + model.id + '", component: { props:' + props + ' } });';

  return '<div id="' + templateId + '" class="${templateId}">' + modelHTML + '</div>' +
    '${css ? '<style>' + escapeCSS(css) + '</style>' : ''}' +
    '<script>' +
    '(function(templateState){' +
      'var targetElement = templateState && templateState.elements && templateState.elements["' + templateId + '"];' +
      'if (templateState && templateState.elements) delete templateState.elements["' + templateId + '"];' +
      // processHtml replaces targetElement.innerHTML with this generated markup
      // before reanimating the script, so the mount div is its first child.
      'var targetNode;' +
      'if (targetElement) {' +
        'targetNode = targetElement.firstElementChild;' +
        'if (!targetNode || targetNode.getAttribute("id") !== "' + templateId + '") {' +
          'throw new Error("Unable to find scoped OC mount target: ' + templateId + '");' +
        '}' +
      '} else {' +
        'targetNode = document.getElementById("' + templateId + '");' +
        'if (!targetNode) {' +
          'throw new Error("Unable to find OC mount target: ' + templateId + '");' +
        '}' +
      '}' +
      'oc = oc || {};' +
      'oc.cmd = oc.cmd || [];' +
      'oc.cmd.push(function(oc){' +
      '${
        css ? "oc.events.fire(\\'oc:cssDidMount\\', \\'" + css + "\\');" : ''
      }' +
        'oc.requireSeries(' + JSON.stringify(externals) + ', function(){' +
          'if (targetElement ? targetNode.parentElement !== targetElement : !targetNode.isConnected) {' +
            'console.warn("Skipping stale OC render for mount target: ' + templateId + '");' +
            'return;' +
          '}' +
          'targetNode.setAttribute("id","");' +
          (ssr ? ssrCall : '') +
          'oc.components["${hash}"]({ id: "' + model.id + '", component: { props: oc.__data["' + model.id + '"]} });' +
          'oc.${templateName}Components["${hash}"](oc.__data["' + model.id + '"], targetNode, ' + !!modelHTML  + ');' +
        '});' +
      '});' +
    '})(oc.__${templateName}Template);' +
  '</script>'
}`;
}
