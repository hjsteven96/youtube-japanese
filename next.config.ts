import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // !! WARN !!
        ignoreBuildErrors: true,
    },
    images: {
        domains: ["img.youtube.com"],
    },
    /* config options here */
    webpack: (config, { isServer }) => {
        // fluent-ffmpeg가 lib-cov 대신 lib 경로를 사용하도록 강제
        config.resolve.alias["fluent-ffmpeg"] = path.join(
            __dirname,
            "node_modules/fluent-ffmpeg/lib/fluent-ffmpeg"
        );
        return config;
    },
};

export default nextConfig;
