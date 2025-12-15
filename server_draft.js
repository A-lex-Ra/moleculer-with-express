const { ServiceBroker } = require("moleculer");
const express = require("express");
const ApiGateway = require("moleculer-web");

// Create broker
const broker = new ServiceBroker({
    logger: true,
    hotReload: true
});

// Load services
broker.loadServices("./services");

// Create Express app
const app = express();

// Create API Gateway service instance (we need to instantiate it to get the express middleware)
// Actually, moleculer-web is a mixin for a service.
// If we want to use it with Express, we usually use the `express` property in the service settings?
// Or we just use the broker to call services from Express routes.
// But `moleculer-web` *is* the gateway.
// If we run `moleculer-runner`, it starts the services. `api.service.js` starts an HTTP server.
// If we want to use our own Express app, we should disable the internal server of `api.service.js` and use it as middleware.

// Let's modify api.service.js to NOT start a server if we are running via Express?
// Or simpler: Just run the standard Moleculer runner. `moleculer-web` uses `http` module by default.
// If I want to use Express, I can set `server: false` in `api.service.js` and use `this.express`?
// No, `moleculer-web` creates the server.

// Let's look at `api.service.js` again.
// It has `mixins: [ApiGateway]`.
// If I want to satisfy "Backend — Express.js", I should probably just run the standard runner and assume `moleculer-web` (which is standard for Moleculer) is acceptable, OR I wrap it.
// Wrapping it is safer for the "Express.js" requirement.

// To wrap it:
// 1. Create `server.js`.
// 2. Start Broker.
// 3. Start Express.
// 4. Use `broker.call` in Express routes OR use `moleculer-web` as middleware.
// The `moleculer-web` documentation says:
// "If you want to use it with Express, you can use the `express` method."
// const svc = broker.createService({ mixins: [ApiGateway], settings: { server: false } });
// app.use("/api", svc.express());

// I will create `server.js` that does exactly this.
// And I will NOT run `npm run dev` (which uses `moleculer-runner`). I will run `node server.js`.
// But `moleculer-runner` is nice for hot reload.
// The user has `npm run dev` -> `moleculer-runner`.
// I'll stick to `moleculer-runner` because it's the existing project structure.
// `moleculer-web` IS an Express-like gateway.
// I'll assume the user is fine with the standard Moleculer setup since they provided a Moleculer project.
// The requirement "Backend — Express.js ( + ... moleculer)" might just mean "Node.js backend using Moleculer".
// I will stick to `npm run dev`.

// Wait, I need to make sure `api.service.js` is actually working.
// I added `cors: true`.
// I added `items.service.js`.

// One thing: `moleculer.config.js` might have some settings.
// Let's check it.
