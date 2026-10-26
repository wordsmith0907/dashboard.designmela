import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader:false,
  // Email-link tokens and password-bearing Server Action arguments must not reach development logs.
  logging:{incomingRequests:false,serverFunctions:false,browserToTerminal:false},
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
    ]}];
  },
};
export default config;
