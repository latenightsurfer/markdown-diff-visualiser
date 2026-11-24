# Configuration

Install the dependencies first:

```bash
npm install
npm run bundle
```

The renderer is created like this:

```ts
const renderer = createRenderer({
  gfm: true,
  basePath: '/workspace',
});
const html = renderer.render(markdown);
```

Use `npm test` to run the tests.
