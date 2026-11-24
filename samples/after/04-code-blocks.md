# Configuration

Install the dependencies first:

```bash
npm install
npm test
npm run bundle
```

The renderer is created like this:

```ts
const renderer = createRenderer({
  gfm: false,
  basePath: '/workspace',
});
const html = renderer.render(markdown);
```

Use `npm test -- --grep table` to run only the table tests.
