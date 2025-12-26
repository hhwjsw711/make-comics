import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoryWithPagesBySlug } from "@/lib/db-actions";
import { db } from "@/lib/db";
import { stories } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storySlug: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { storySlug: slug } = await params;

    // Special case: if slug is "all", return user's stories for debugging
    if (slug === "all") {
      const userStories = await db.select().from(stories).where(eq(stories.userId, userId));
      return NextResponse.json({
        message: "User stories",
        stories: userStories.map(s => ({ id: s.id, slug: s.slug, title: s.title }))
      });
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Story slug is required" },
        { status: 400 }
      );
    }

    const result = await getStoryWithPagesBySlug(slug);

    if (!result) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    // Check if the story belongs to the authenticated user
    if (result.story.userId !== userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching story:", error);
    return NextResponse.json(
      { error: "Failed to fetch story" },
      { status: 500 }
    );
  }
}