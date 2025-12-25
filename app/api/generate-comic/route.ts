import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";
import { auth } from "@clerk/nextjs/server";
import {
  updatePage,
  createStory,
  createPage,
  getNextPageNumber,
} from "@/lib/db-actions";

const NEW_MODEL = false;
const IMAGE_MODEL = NEW_MODEL
  ? "google/gemini-3-pro-image"
  : "google/flash-image-2.5";
const FIXED_DIMENSIONS = NEW_MODEL
  ? { width: 896, height: 1200 }
  : { width: 864, height: 1184 };

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
        `Vision API error for character ${characterNumber}:`,
        await response.text()
      );
      return `Character ${characterNumber}`;
    }

    const data = await response.json();
    const description =
      data.choices?.[0]?.message?.content || `Character ${characterNumber}`;
    console.log(`Character ${characterNumber} description:`, description);
    return description;
  } catch (error) {
    console.error(`Error analyzing character ${characterNumber}:`, error);
    return `Character ${characterNumber}`;
  }
}

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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const {
      storyId,
      prompt,
      apiKey,
      style = "noir",
      characterImages = [],
      isContinuation = false,
      previousContext = "",
    } = await request.json();

    console.log("Received request:", { storyId, prompt: prompt?.substring(0, 50), characterImagesCount: characterImages.length, userId });

    if (!prompt || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let page;
    let story;

    if (storyId) {
      // Create page for existing story
      console.log("Creating page for existing story:", storyId);
      const nextPageNumber = await getNextPageNumber(storyId);
      page = await createPage({
        storyId,
        pageNumber: nextPageNumber,
        prompt,
        characterImageUrls: characterImages,
        style,
      });
      console.log("Page created:", page.id);
    } else {
      // Create new story and first page
      console.log("Creating new story for user:", userId);
      story = await createStory({
        title: prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
        description: undefined,
        userId: userId,
      });
      console.log("Story created:", story.id);

      page = await createPage({
        storyId: story.id,
        pageNumber: 1,
        prompt,
        characterImageUrls: characterImages,
        style,
      });
      console.log("First page created:", page.id);
    }

    const dimensions = FIXED_DIMENSIONS;
    const styleDesc = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.noir;

    const continuationContext =
      isContinuation && previousContext
        ? `\nCONTINUATION CONTEXT:\nThis is a continuation of an existing story. The previous page showed: ${previousContext}\nMaintain visual consistency with the previous panels. Continue the narrative naturally.\n`
        : "";

    let characterSection = "";
    if (characterImages.length > 0) {
      if (characterImages.length === 1) {
        characterSection = `
CRITICAL FACE CONSISTENCY INSTRUCTIONS:
- REFERENCE CHARACTER: Use the uploaded image as EXACT reference for the protagonist's face and appearance
- FACE MATCHING: The character's face must be IDENTICAL to the reference image - same eyes, nose, mouth, hair, facial structure
- APPEARANCE PRESERVATION: Maintain exact skin tone, hair color/style, eye color, and distinctive facial features
- CHARACTER CONSISTENCY: This exact same character must appear in ALL 5 panels with the same face throughout
- STYLE APPLICATION: Apply ${style} comic art style to the body/pose/action but KEEP THE FACE EXACTLY AS IN THE REFERENCE IMAGE
- NO VARIATION: Do not alter, modify, or change the character's face in any way from the reference`;
      } else if (characterImages.length === 2) {
        characterSection = `
CRITICAL DUAL CHARACTER FACE CONSISTENCY INSTRUCTIONS:
- CHARACTER 1 REFERENCE: Use the FIRST uploaded image as EXACT reference for Character 1's face and appearance
- CHARACTER 2 REFERENCE: Use the SECOND uploaded image as EXACT reference for Character 2's face and appearance
- FACE MATCHING: Both characters' faces must be IDENTICAL to their respective reference images
- VISUAL DISTINCTION: Keep both characters clearly visually distinct with their unique faces, hair, and features
- CONSISTENT PRESENCE: Both characters must appear together in at least 4 of the 5 panels
- STYLE APPLICATION: Apply ${style} comic art style while maintaining EXACT facial features from references
- NO FACE VARIATION: Never alter or modify either character's face from their reference images`;
      }
    }

    const systemPrompt = `Professional comic book page illustration.
${continuationContext}
${characterSection}

CHARACTER CONSISTENCY RULES (HIGHEST PRIORITY):
- If reference images are provided, the characters' FACES must be 100% identical to the reference images
- Never change hair color, eye color, facial structure, or distinctive features
- Apply comic style to body/pose/action but preserve exact facial appearance
- Same character must look identical across all panels they appear in

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

    console.log("Generating comic with prompt length:", fullPrompt.length);

    const client = new Together({ apiKey });

    let response;
    try {
      response = await client.images.generate({
        model: IMAGE_MODEL,
        prompt: fullPrompt,
        width: dimensions.width,
        height: dimensions.height,
        temperature: 0.1, // Lower temperature for more consistent face matching
        reference_images:
          characterImages.length > 0 ? characterImages : undefined,
      });
    } catch (error) {
      console.error("Together AI API error:", error);

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

    const imageUrl = response.data[0].url;

    // Update page in database
    try {
      await updatePage(page.id, imageUrl);
      console.log("Page updated with image:", page.id);
    } catch (dbError) {
      console.error("Error updating page in database:", dbError);
      return NextResponse.json(
        { error: "Failed to save generated image" },
        { status: 500 }
      );
    }

    const responseData = storyId
      ? { imageUrl, pageId: page.id, pageNumber: page.pageNumber }
      : {
          imageUrl,
          storyId: story!.id,
          storySlug: story!.slug,
          pageId: page.id,
          pageNumber: page.pageNumber,
        };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error in generate-comic API:", error);
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
