import { NextApiRequest, NextApiResponse } from "next";
import { transportMap } from "@/lib/mcp/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const sessionId = req.query.sessionId as string;
  
  if (!sessionId) {
    res.status(400).send("Missing sessionId");
    return;
  }

  const transport = transportMap.get(sessionId);

  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }

  await transport.handlePostMessage(req, res);
}
