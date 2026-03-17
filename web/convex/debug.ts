import { query } from "./_generated/server";

export const checkAuth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return {
      isAuthenticated: identity !== null,
      identity: identity
        ? {
            subject: identity.subject,
            issuer: identity.issuer,
            name: identity.name,
            email: identity.email,
          }
        : null,
    };
  },
});
