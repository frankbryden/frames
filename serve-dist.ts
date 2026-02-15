import { serve } from "bun";

serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    
    const file = Bun.file(`./dist${path}`);
    return new Response(file);
  }
});

console.log("Serving built files at http://localhost:3001");
