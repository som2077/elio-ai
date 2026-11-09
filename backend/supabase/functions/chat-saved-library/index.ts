// Supabase Edge Function: chat-saved-library
// Conversational RAG Engine for "Ask Elio" with grounded video citations

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatPayload {
  prompt: string;
  action?: "chat" | "search";
  history?: { role: "user" | "assistant"; content: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Retrieve API key securely: 1) Environment variable, 2) Encrypted Supabase Vault via service_role
    let openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    let aiGatewayKey = Deno.env.get("AI_GATEWAY_API_KEY") ?? "";

    if ((!openaiApiKey || !aiGatewayKey) && supabaseServiceKey) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      if (!openaiApiKey) {
        const { data: vaultKey } = await adminClient.rpc(
          "get_internal_ai_secret",
          {
            p_name: "OPENAI_API_KEY",
          },
        );
        openaiApiKey = vaultKey ?? "";
      }
      if (!aiGatewayKey) {
        const { data: vaultGwKey } = await adminClient.rpc(
          "get_internal_ai_secret",
          {
            p_name: "AI_GATEWAY_API_KEY",
          },
        );
        aiGatewayKey = vaultGwKey || "vck_7zi2EmI4PKgs7ZSibBe8UymuvYN9aAooOlk40V7NBuTamEw4QL2jIitE";
      }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Authenticate user
    const client = createClient(
      supabaseUrl,
      supabaseAnonKey || supabaseServiceKey,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const body: ChatPayload & { user_id?: string } = await req.json();
    const { prompt, action = "chat", history = [], user_id } = body;

    let targetUserId = "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (token === supabaseServiceKey && user_id) {
      targetUserId = user_id;
    } else {
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized user" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = user.id;
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Empty or invalid prompt" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Security: Input length limit to prevent token flood attacks
    if (prompt.length > 2000) {
      return new Response(
        JSON.stringify({
          error: "Prompt exceeds maximum allowed length of 2000 characters.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Generate Embedding for User Prompt
    let promptEmbedding: number[] = [];
    if (openaiApiKey) {
      const embRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: prompt,
        }),
      });

      if (embRes.ok) {
        const embData = await embRes.json();
        promptEmbedding = embData.data?.[0]?.embedding || [];
      }
    }

    // 2. Query Vector Chunks via `match_video_chunks` RPC
    let matchedChunks: any[] = [];
    if (promptEmbedding.length > 0) {
      const { data: chunks, error: rpcError } = await client.rpc(
        "match_video_chunks",
        {
          p_user_id: targetUserId,
          p_embedding: promptEmbedding,
          p_match_threshold: action === "search" ? 0.35 : 0.4,
          p_match_count: action === "search" ? 10 : 6,
        },
      );

      if (!rpcError && Array.isArray(chunks)) {
        matchedChunks = chunks;
      }
    }

    // Direct return if user only requested Semantic Search
    if (action === "search") {
      return new Response(
        JSON.stringify({
          results: matchedChunks,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Format Context for LLM
    let contextBlock =
      "No directly matching video transcripts found in user library.";
    const citations: any[] = [];

    if (matchedChunks.length > 0) {
      contextBlock = matchedChunks
        .map((c, i) => {
          citations.push({
            video_id: c.video_id,
            title: c.title,
            start_seconds: c.start_seconds,
            clean_url: c.clean_url,
            platform: c.platform,
            thumbnail_url: c.thumbnail_url,
          });

          const minutes = Math.floor(c.start_seconds / 60);
          const seconds = c.start_seconds % 60;
          const timeFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

          return `[Source ${i + 1}: "${c.title}" at ${timeFormatted}]\n"${c.chunk_text}"`;
        })
        .join("\n\n");
    }

    // 4. Construct System Prompt & Messages
    const systemPrompt = `You are "Ask Elio", an intelligent AI Second Brain assistant.
Your goal is to answer the user's questions based EXCLUSIVELY on their saved video clips and transcripts.
- Be concise, friendly, and direct.
- When referencing a fact, mention which video it came from and the time stamp.
- If the user's question cannot be answered from their saved videos, politely inform them that you checked their library and couldn't find a matching clip, then offer a general suggestion.

Available Context from User's Saved Videos:
${contextBlock}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-4), // Last 2 turns of conversation
      { role: "user", content: prompt },
    ];

    let replyText =
      "I reviewed your saved clips, but didn't find a video discussing this topic.";
    let chatAnswered = false;

    // Prioritize Vercel AI Gateway
    if (aiGatewayKey) {
      try {
        const gwRes = await fetch(
          "https://ai-gateway.vercel.sh/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiGatewayKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini",
              temperature: 0.4,
              messages,
            }),
          },
        );
        if (gwRes.ok) {
          const gwJson = await gwRes.json();
          replyText = gwJson.choices?.[0]?.message?.content || replyText;
          chatAnswered = true;
        }
      } catch (e) {
        console.warn("[chat-saved-library] AI Gateway call failed:", e);
      }
    }

    if (!chatAnswered && openaiApiKey) {
      const chatRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.4,
            messages,
          }),
        },
      );

      if (chatRes.ok) {
        const chatJson = await chatRes.json();
        replyText = chatJson.choices?.[0]?.message?.content || replyText;
      }
    }

    return new Response(
      JSON.stringify({
        answer: replyText,
        citations,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[chat-saved-library] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
