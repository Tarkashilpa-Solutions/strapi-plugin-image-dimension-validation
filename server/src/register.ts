import type { Core } from "@strapi/strapi";

const register = ({ strapi: _strapi }: { strapi: Core.Strapi }) => {
  // register phase — no registration-time setup is required for this plugin.
};

export default register;