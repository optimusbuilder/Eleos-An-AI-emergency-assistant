import { NextResponse } from "next/server";
import { PrismaUserRepository } from "../../../../worker/src/db/prisma-repositories";
import { unstable_noStore as noStore } from "next/cache";

export async function GET() {
  noStore();
  try {
    const userRepository = new PrismaUserRepository();
    const user = await userRepository.getPrimaryUser();
    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const userRepository = new PrismaUserRepository();
    
    // Get primary user first to have the ID
    const primaryUser = await userRepository.getPrimaryUser();
    
    const updatedUser = await userRepository.updateUser(primaryUser.id, body);
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
