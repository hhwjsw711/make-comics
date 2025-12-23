import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";

const FIXED_DIMENSIONS = { width: 864, height: 1184 };

const STYLE_DESCRIPTIONS: Record<string, string> = {
  noir: "film noir style, high contrast black and white, deep dramatic shadows, 1940s detective aesthetic, heavy bold inking, moody atmospheric lighting",
  manga:
    "Japanese manga style, clean precise black linework, screen tone shading, expressive eyes, dynamic speed lines, black and white with impact effects",
  superhero:
    "classic American superhero comic style, bold vibrant colors, dynamic heroic poses, detailed muscular anatomy, Jim Lee and Jack Kirby inspired",
  vintage:
    "Golden Age 1950s comic style, visible halftone Ben-Day dots, limited retro color palette, nostalgic warm tones, classic adventure comics",
  modern:
    "contemporary digital comic art, smooth gradient coloring, detailed realistic backgrounds, cinematic widescreen composition, graphic novel quality",
  watercolor:
    "painted watercolor comic style, soft blended edges, flowing artistic colors, delicate linework with painted fills, ethereal atmosphere",
};

async function analyzeCharacterImage(
  imageBase64: string,
  apiKey: string,
  characterNumber: number
): Promise<string> {
  try {
    // Clean base64 string
    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

    const response = await fetch(
      "https://api.together.xyz/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this person for a comic book character reference. Provide a detailed physical description in one paragraph. Include:
- Gender and approximate age
- Face shape (round, oval, square, etc.)
- Hair: color, length, style, texture
- Eye color and shape
- Skin tone
- Body type/build
- Any distinctive features (glasses, facial hair, freckles, etc.)
- Current outfit/clothing style and colors

Be VERY specific and detailed. This description will be used to draw this exact person as a comic character. Respond ONLY with the physical description, no other text.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        `[v0] Vision API error for character ${characterNumber}:`,
        await response.text()
      );
      return `Character ${characterNumber}`;
    }

    const data = await response.json();
    const description =
      data.choices?.[0]?.message?.content || `Character ${characterNumber}`;
    console.log(`[v0] Character ${characterNumber} description:`, description);
    return description;
  } catch (error) {
    console.error(`[v0] Error analyzing character ${characterNumber}:`, error);
    return `Character ${characterNumber}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      apiKey,
      style = "noir",
      characterImages = [],
      isContinuation = false,
      previousContext = "",
    } = await request.json();

    if (!prompt || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const dimensions = FIXED_DIMENSIONS;
    const styleDesc = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.noir;

    const continuationContext =
      isContinuation && previousContext
        ? `\nCONTINUATION CONTEXT:\nThis is a continuation of an existing story. The previous page showed: ${previousContext}\nMaintain visual consistency with the previous panels. Continue the narrative naturally.\n`
        : "";

    let characterSection = "";
    if (characterImages.length > 0) {
      console.log(
        `[v0] Analyzing ${characterImages.length} character image(s)...`
      );

      const characterDescriptions = await Promise.all(
        characterImages.map((img: string, index: number) =>
          analyzeCharacterImage(img, apiKey, index + 1)
        )
      );

      if (characterImages.length === 1) {
        characterSection = `
MAIN CHARACTER (MUST APPEAR IN EVERY PANEL):
${characterDescriptions[0]}

CRITICAL INSTRUCTIONS:
- This EXACT character must appear in ALL 5 panels
- Draw them in ${style} comic art style but keep their EXACT appearance
- Same face, same hair, same outfit, same features in every panel
- They are the PROTAGONIST - center of every scene`;
      } else if (characterImages.length === 2) {
        characterSection = `
TWO MAIN CHARACTERS (BOTH MUST APPEAR TOGETHER IN MOST PANELS):

CHARACTER 1 - "FIRST PERSON":
${characterDescriptions[0]}

CHARACTER 2 - "SECOND PERSON":
${characterDescriptions[1]}

CRITICAL INSTRUCTIONS:
- BOTH characters must appear together in at least 4 of the 5 panels
- Keep them VISUALLY DISTINCT - do not mix up their features
- CHARACTER 1 and CHARACTER 2 are DIFFERENT PEOPLE with different appearances
- If one is female and one is male, keep their genders correct
- Draw both in ${style} comic art style but preserve their EXACT individual appearances
- Each character must be immediately recognizable in every panel they appear
- They are the two protagonists interacting with each other throughout the story`;
      }
    }

    const systemPrompt = `Professional comic book page illustration.
${continuationContext}
TEXT AND LETTERING (CRITICAL):
- All text in speech bubbles must be PERFECTLY CLEAR, LEGIBLE, and correctly spelled
- Use bold clean comic book lettering, large and easy to read
- Speech bubbles: crisp white fill, solid black outline, pointed tail toward speaker
- Keep dialogue SHORT: maximum 1-2 sentences per bubble
- NO blurry, warped, or unreadable text

PAGE LAYOUT:
5-panel comic page arranged as:
[Panel 1] [Panel 2] — top row, 2 equal panels
[    Panel 3      ] — middle row, 1 large cinematic hero panel
[Panel 4] [Panel 5] — bottom row, 2 equal panels
- Solid black panel borders with clean white gutters between panels
- Each panel clearly separated and distinct

ART STYLE:
${styleDesc}
${characterSection}

COMPOSITION:
- Vary camera angles across panels: close-up, medium shot, wide establishing shot
- Natural visual flow: left-to-right, top-to-bottom reading order
- Dynamic character poses with clear expressive acting
- Detailed backgrounds matching the scene and mood`;

    const fullPrompt = `${systemPrompt}\n\nSTORY:\n${prompt}`;

    console.log("[v0] Generating comic with prompt length:", fullPrompt.length);

    const client = new Together({ apiKey });

    let response;
    try {
      response = await client.images.generate({
        model: "google/flash-image-2.5",
        prompt: fullPrompt,
        width: dimensions.width,
        height: dimensions.height,
        n: 1,
        reference_images: characterImages,
      });
    } catch (error) {
      console.error("[v0] Together AI API error:", error);

      if (error instanceof Error && "status" in error) {
        const status = (error as any).status;
        if (status === 402) {
          return NextResponse.json(
            {
              error:
                "Insufficient API credits. Please add credits to your Together.ai account at https://api.together.ai/settings/billing or update your API key.",
              errorType: "credit_limit",
            },
            { status: 402 }
          );
        }
        return NextResponse.json(
          {
            error: error.message || `Failed to generate image: ${status}`,
            errorType: "api_error",
          },
          { status: status || 500 }
        );
      }

      return NextResponse.json(
        {
          error: `Internal server error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }

    if (!response.data || !response.data[0] || !response.data[0].url) {
      return NextResponse.json(
        { error: "No image URL in response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl: response.data[0].url });
  } catch (error) {
    console.error("[v0] Error in generate-comic API:", error);
    return NextResponse.json(
      {
        error: `Internal server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
