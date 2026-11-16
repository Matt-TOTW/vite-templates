import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import vm from 'node:vm';

type HtmlTemplate =
  typeof import('../../packages/oc-vite-compiler/src/lib/htmlTemplate').default;

const require = createRequire(import.meta.url);
const htmlTemplate = (
  require('../../packages/oc-vite-compiler/dist/lib/htmlTemplate.js') as {
    default: HtmlTemplate;
  }
).default;

interface RenderedShadowComponent {
  component: HTMLElement;
  root: ShadowRoot;
}

type RequireSeries = (
  externals: Array<{ global: string; url: string }>,
  callback: () => void
) => void;

interface TestOcClient {
  __reactTemplate?: { elements?: Record<string, HTMLElement> };
  events: {
    on(
      eventName: 'oc:componentDidMount',
      listener: (event: { type: string }, component: { name: string }) => void
    ): void;
  };
  renderNestedComponent(component: HTMLElement, callback: () => void): void;
  requireSeries: RequireSeries;
}

interface ShadowDomTestState {
  first: RenderedShadowComponent;
  second: RenderedShadowComponent;
  removed: RenderedShadowComponent;
  pending: Array<() => void>;
  mountedNames: string[];
  originalRequireSeries: RequireSeries;
}

type TestWindow = typeof window & {
  oc: TestOcClient;
  shadowDomTest: ShadowDomTestState;
};

test('queues server-rendered templates in a fresh browser context', () => {
  const templateSource = htmlTemplate({
    templateId: 'oc-reactRoot-ssr-test',
    templateName: 'react',
    externals: [],
    css: '',
    bundle: 'function() {}',
    hash: 'ssr-test-hash',
  });
  const serverTemplate = vm.runInNewContext(`(${templateSource})`, {
    oc: {},
  }) as (model: {
    id: string;
    __html: string;
    component: { props: Record<string, string> };
  }) => string;
  const html = serverTemplate({
    id: 'ssr-test-id',
    __html: '<p>Server-rendered content</p>',
    component: {
      props: {
        _staticPath: '/static/',
        _baseUrl: '/',
        _componentName: 'ssr-test',
        _componentVersion: '1.0.0',
      },
    },
  });
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  const browserOc = { cmd: [] as Array<(oc: unknown) => void> };

  expect(script).toBeDefined();
  expect(() =>
    vm.runInNewContext(script!, {
      oc: browserOc,
      document: { getElementById: () => ({ isConnected: true }) },
    })
  ).not.toThrow();
  expect(browserOc.cmd).toHaveLength(1);
});

test('renders React templates inside closed shadow roots', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      consoleWarnings.push(message.text());
    }
  });

  await page.goto(
    '/base-component-react/1.0.0/~preview?name=Control&year=1991',
    { waitUntil: 'domcontentloaded' }
  );
  await expect(
    page.getByRole('heading', { name: 'Hello, Control' })
  ).toBeVisible();

  await page.evaluate(() => {
    const testWindow = window as TestWindow;
    const oc = testWindow.oc;
    const originalRequireSeries = oc.requireSeries;
    const pending: Array<() => void> = [];
    const mountedNames: string[] = [];

    oc.requireSeries = (externals, callback) => {
      pending.push(() => originalRequireSeries(externals, callback));
    };
    oc.events.on('oc:componentDidMount', (_event, component) => {
      mountedNames.push(component.name);
    });

    const render = (name: string) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = host.attachShadow({ mode: 'closed' });
      const component = document.createElement('oc-component');
      component.setAttribute(
        'href',
        `/base-component-react/1.0.0?name=${encodeURIComponent(name)}&year=1991`
      );
      component.setAttribute('disable-lifecycle', 'true');
      root.appendChild(component);
      oc.renderNestedComponent(component, () => {});
      return { component, root };
    };

    const first = render('First shadow component');
    const second = render('Second shadow component');
    const removed = render('Removed shadow component');

    testWindow.shadowDomTest = {
      first,
      second,
      removed,
      pending,
      mountedNames,
      originalRequireSeries,
    };
  });

  await expect
    .poll(() =>
      page.evaluate(() => (window as TestWindow).shadowDomTest.pending.length)
    )
    .toBe(3);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys((window as TestWindow).oc.__reactTemplate?.elements ?? {})
            .length
      )
    )
    .toBe(0);

  await page.evaluate(() => {
    const testWindow = window as TestWindow;
    const state = testWindow.shadowDomTest;

    state.removed.component.replaceChildren();
    state.pending.reverse().forEach((complete) => complete());
    testWindow.oc.requireSeries = state.originalRequireSeries;
  });

  const shadowState = () =>
    page.evaluate(() => {
      const state = (window as TestWindow).shadowDomTest;
      const text = (root: ShadowRoot) =>
        root.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
      const card = state.first.root.querySelector('h1')?.parentElement;

      return {
        firstText: text(state.first.root),
        secondText: text(state.second.root),
        removedText: text(state.removed.root),
        firstCardBackground: card
          ? window.getComputedStyle(card).backgroundColor
          : null,
        mountedNames: [...state.mountedNames].sort(),
      };
    });

  await expect
    .poll(async () => (await shadowState()).firstText)
    .toBe('Hello, First shadow component');
  await expect
    .poll(async () => (await shadowState()).secondText)
    .toBe('Hello, Second shadow component');
  await expect
    .poll(async () => (await shadowState()).mountedNames)
    .toEqual(['First shadow component', 'Second shadow component']);

  const finalState = await shadowState();
  expect(finalState.removedText).toBeUndefined();
  expect(finalState.firstCardBackground).toBe('rgb(255, 255, 255)');
  expect(consoleWarnings).toContainEqual(
    expect.stringContaining('Skipping stale OC render for mount target')
  );
  expect(pageErrors).toEqual([]);
});
