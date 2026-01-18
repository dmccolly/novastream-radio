import { getStore } from "@netlify/blobs";

export default async (req: Request) => {
  const store = getStore("novastream");
  
  if (req.method === "GET") {
    // Load track index
    try {
      const data = await store.get("track_index", { type: "json" });
      if (!data) {
        return new Response(JSON.stringify({ tracks: [], trackCount: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  if (req.method === "POST") {
    // Save track index
    try {
      const body = await req.json();
      await store.setJSON("track_index", body);
      return new Response(JSON.stringify({ success: true, trackCount: body.trackCount }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/track-index"
};
