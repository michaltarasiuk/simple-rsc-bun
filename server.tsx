import path from "node:path";
import * as ReactServerDom from "react-server-dom-webpack/server.browser";

import { clientComponentMap } from "./bundle";
import { SEARCH_QUERY_KEY } from "./app/consts";

const cwd = process.cwd();

const notFound = () => {
  return new Response("404!", {
    status: 404,
  });
};

type Resolver = (request: Request) => Response | Promise<Response>;

const staticFileResolver: Resolver = async (request: Request) => {
  const requestURL = new URL(request.url);

  const filePath = path.join(cwd, requestURL.pathname);
  const file = Bun.file(filePath);

  if (await file.exists()) return new Response(file);
  return notFound();
};

const rscStreamResolver: Resolver = async ({ url }: Request) => {
  const { Page } = await import("./dist/page");
  const { searchParams } = new URL(url);

  const stream = ReactServerDom.renderToReadableStream(
    <Page search={searchParams.get(SEARCH_QUERY_KEY)} />,
    clientComponentMap
  );

  return new Response(stream);
};

async function streamToString(stream: ReadableStream<Uint8Array>) {
  try {
    const textDecoder = new TextDecoder("utf-8", {
      fatal: true,
    });

    let string = "";
    // @ts-expect-error TypeScript gets this wrong (https://nodejs.org/api/webstreams.html#async-iteration)
    for await (const chunk of stream) {
      string += textDecoder.decode(chunk);
    }
    return string;
  } catch {
    return null;
  }
}

const rscStringResolver: Resolver = async ({ url }: Request) => {
  const { Page } = await import("./dist/page");
  const { searchParams } = new URL(url);

  const stream = ReactServerDom.renderToReadableStream(
    <Page search={searchParams.get(SEARCH_QUERY_KEY)} />,
    clientComponentMap
  );
  await stream.allReady;

  const string = await streamToString(stream);
  return new Response(string, {
    headers: {
      "Content-Type": "text/x-component",
    },
  });
};

const routeResolvers = {
  "/public/(.*)": staticFileResolver,
  "/dist/(.*)": staticFileResolver,
  "/rsc": rscStreamResolver,
  "/rsc-string": rscStringResolver,
} satisfies Record<string, (request: Request) => Response | Promise<Response>>;

function addBoundaryAssertion(pattern: string) {
  return `^${pattern}$`;
}

const routeEntries = Object.entries(routeResolvers).map(
  ([path, resolver]) =>
    [new RegExp(addBoundaryAssertion(path)), resolver] as const
);

function resolveRoute(request: Request) {
  const url = new URL(request.url);
  const routeEntry = routeEntries.find(([path]) => path.test(url.pathname));

  return routeEntry?.[1] ?? (() => notFound());
}

const server = Bun.serve({
  async fetch(request) {
    const route = resolveRoute(request);
    return await route(request);
  },
});

console.log(
  `Listening on http://${server.hostname}:${server.port}/public/root.html`
);
