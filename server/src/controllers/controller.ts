import type { Core } from "@strapi/strapi";
import type { Context } from "koa";

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx: Context) {
    try {
      const plugin = strapi.plugin("image-validation");
      ctx.body = plugin.service("service").getWelcomeMessage();
    } catch (err) {
      ctx.status = 500;
      ctx.body = { error: "Failed to retrieve welcome message" };
      strapi.log.error(err);
    }
  },
});

export default controller;