import { start } from "../../lib/http.js";

start({
  name: process.env.SERVICE_NAME || "user",
  routes: [
    {
      method: "GET",
      path: "/users/demo",
      handler() {
        return {
          body: {
            user: {
              id: "asha",
              name: "Asha Menon",
              email: "asha@classroom.relaymart",
              city: "Bengaluru",
            },
          },
        };
      },
    },
  ],
});
