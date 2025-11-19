// services/telegram/telegramUserResolverService.ts
import { prisma } from "../../lib/prisma";
import { Api } from "telegram";

export const TelegramUserResolverService = {
  async getUser(accountId: string, client: any, userId: string) {
    // 1️⃣ First check local DB cache
    const cached = await prisma.telegramUserCache.findUnique({
      where: {
        accountId_userId: {
          accountId,
          userId,
        },
      },
    });

    if (cached) {
      return {
        id: userId,
        firstName: cached.firstName ?? null,
        lastName: cached.lastName ?? null,
        username: cached.username ?? null,
        name:
          [cached.firstName, cached.lastName].filter(Boolean).join(" ") ||
          cached.username ||
          null,
      };
    }

    // 2️⃣ Resolve InputUser (this works even if client doesn't know entity!)
    let inputUser;
    try {
      inputUser = await client.getInputEntity(Number(userId));
    } catch (err) {
      console.warn("[UserResolver] getInputEntity failed:", err);
      return null;
    }

    // 3️⃣ Fetch full user data via RPC users.getUsers
    let user: any = null;
    try {
      const result = await client.invoke(
        new Api.users.GetUsers({
          id: [inputUser],
        })
      );

      user = result[0];
    } catch (err) {
      console.warn("[UserResolver] RPC GetUsers failed:", err);
      return null;
    }

    if (!user) return null;

    // 4️⃣ Save to DB cache
    await prisma.telegramUserCache.upsert({
      where: {
        accountId_userId: {
          accountId,
          userId,
        },
      },
      update: {
        firstName: "firstName" in user ? user.firstName : null,
        lastName: "lastName" in user ? user.lastName : null,
        username: "username" in user ? user.username : null,
        updatedAt: new Date(),
      },
      create: {
        accountId,
        userId,
        firstName: "firstName" in user ? user.firstName : null,
        lastName: "lastName" in user ? user.lastName : null,
        username: "username" in user ? user.username : null,
      },
    });

    return {
      id: userId,
      firstName: "firstName" in user ? user.firstName : null,
      lastName: "lastName" in user ? user.lastName : null,
      username: "username" in user ? user.username : null,
      name:
        [
          "firstName" in user ? user.firstName : null,
          "lastName" in user ? user.lastName : null,
        ]
          .filter(Boolean)
          .join(" ") ||
        ("username" in user ? user.username : null) ||
        null,
    };
  },
  async resolveName(accountId: string, client: any, userId: string) {
    const user = await this.getUser(accountId, client, userId);
    return user?.name ?? null;
  },
};
