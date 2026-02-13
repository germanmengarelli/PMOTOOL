import AzureAD from "next-auth/providers/azure-ad";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  ],
  session: {
    strategy: "jwt",
  },
};