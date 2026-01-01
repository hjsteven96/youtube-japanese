import type { NextApiRequest, NextApiResponse } from "next";
import { POST as translationPost } from "@/app/api/korean-translation/route";

const toJsonBody = (body: NextApiRequest["body"]) => {
    if (typeof body === "string") {
        return body;
    }
    return JSON.stringify(body || {});
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const request = new Request("http://localhost/api/korean-translation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: toJsonBody(req.body),
    });

    const response = await translationPost(request);
    const data = await response.json();
    res.status(response.status).json(data);
}
