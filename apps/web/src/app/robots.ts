import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/portal/", "/setup/", "/api/"],
      },
    ],
    sitemap: "https://qsasset.com/sitemap.xml",
  };
}
