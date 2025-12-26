import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";
import { auth } from "@clerk/nextjs/server";
import {
  updatePage,
  createStory,
  createPage,
  getNextPageNumber,
  getStoryById,
} from "@/lib/db-actions";
import { freeTierRateLimit } from "@/lib/rate-limit";
import { COMIC_STYLES } from "@/lib/constants";

const NEW_MODEL = false;

const IMAGE_MODEL = NEW_MODEL
  ? "google/gemini-3-pro-image"
  : "google/flash-image-2.5";

const FIXED_DIMENSIONS = NEW_MODEL
  ? { width: 896, height: 1200 }
  : { width: 864, height: 1184 };

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

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Determine which API key to use
    let finalApiKey = apiKey;
    const isUsingFreeTier = !apiKey;

    if (isUsingFreeTier) {
      // Using free tier - apply rate limiting
      const { success, reset } = await freeTierRateLimit.limit(userId);

      if (!success) {
        const resetDate = new Date(reset);
        const timeUntilReset = Math.ceil(
          (reset - Date.now()) / (1000 * 60 * 60 * 24)
        ); // days

        return NextResponse.json(
          {
            error: `Free tier limit reached. You can generate 1 comic per week. Try again in ${timeUntilReset} day(s), or provide your own API key for unlimited access.`,
            resetDate: resetDate.toISOString(),
            isRateLimited: true,
          },
          { status: 429 }
        );
      }

      // Use default API key for free tier
      finalApiKey = process.env.TOGETHER_API_KEY_DEFAULT;
      if (!finalApiKey) {
        return NextResponse.json(
          {
            error: "Server configuration error - default API key not available",
          },
          { status: 500 }
        );
      }
    }

    let page;
    let story;

    if (storyId) {
      const story = await getStoryById(storyId);
      if (!story) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }

      const nextPageNumber = await getNextPageNumber(storyId);
      page = await createPage({
        storyId,
        pageNumber: nextPageNumber,
        prompt,
        characterImageUrls: characterImages,
      });
    } else {
      story = await createStory({
        title: prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
        description: undefined,
        userId: userId,
        style,
      });

      page = await createPage({
        storyId: story.id,
        pageNumber: 1,
        prompt,
        characterImageUrls: characterImages,
      });
    }

    const dimensions = FIXED_DIMENSIONS;
    const styleInfo = COMIC_STYLES.find((s) => s.id === style);
    const styleDesc = styleInfo?.prompt || COMIC_STYLES[2].prompt;

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

    const client = new Together({ apiKey: finalApiKey });

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
