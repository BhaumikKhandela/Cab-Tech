import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/login", (c) => {
  return c.text("login successfull");
});

export default app;
