import { renderToString } from "react-dom/server";
import { HelloWorld } from "./app/HelloWorld";
import { createElement } from "react";

const routeResolvers = {
  "/": (_request: Request) => {
    const html = renderToString(createElement(HelloWorld));
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  },
} satisfies Record<string, (request: Request) => Response>;

const routeEntries = Object.entries(routeResolvers);

function resolveRoute(request: Request) {
  const url = new URL(request.url);

  const routeEntry = routeEntries.find(([path]) => path === url.pathname);
  if (!routeEntry) {
    return () => new Response("404!");
  }

  return routeEntry[1];
}

Bun.serve({
  fetch(request) {
    const route = resolveRoute(request);

    return route(request);
  },
});
