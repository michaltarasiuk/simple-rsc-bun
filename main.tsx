import path from "node:path";
import { renderToString } from "react-dom/server";
import { HelloWorld } from "./app/HelloWorld";

type Resolver = (request: Request) => Response | Promise<Response>;

const notFound = () => {
  return new Response("404!", {
    status: 404,
  });
};

const staticFileResolver: Resolver = async (request: Request) => {
  const requestURL = new URL(request.url);
  const filePath = path.join(process.cwd(), requestURL.pathname);

  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file);
  }

  return notFound();
};

const routeResolvers = {
  "/public/(.*)": staticFileResolver,
  "/dist/(.*)": staticFileResolver,
  "/rsc": (_request: Request) => {
    const html = renderToString(<HelloWorld />);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  },
} satisfies Record<string, (request: Request) => Response | Promise<Response>>;

const routeEntries = Object.entries(routeResolvers);

function resolveRoute(request: Request) {
  const url = new URL(request.url);
  const [, route] = routeEntries.find(([path]) =>
    new RegExp(path).test(url.pathname)
  ) ?? [null, () => notFound()];
  return route;
}

Bun.serve({
  async fetch(request) {
    const route = resolveRoute(request);
    return await route(request);
  },
});
