import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getRelatedGames,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns other games in the same category ordered by title', async () => {
        await seedGames(db, 3);
        const [otherCategory] = await db
            .insert(categories)
            .values({ name: 'Puzzle', description: 'other category' })
            .returning({ id: categories.id });
        const [publisher] = await db
            .insert(publishers)
            .values({ name: 'Pub Two', description: 'other publisher' })
            .returning({ id: publishers.id });
        await db.insert(games).values({
            title: 'Different Category Game',
            description: 'Description',
            starRating: 4.2,
            categoryId: otherCategory.id,
            publisherId: publisher.id,
        });

        const all = await getAllGames(db);
        const currentGame = all.find((game) => game.title === 'Game 02');
        const related = await getRelatedGames(
            db,
            currentGame?.category?.id ?? null,
            currentGame?.id ?? -1,
        );

        expect(related.map((game) => game.title)).toEqual(['Game 01', 'Game 03']);
    });

    it('returns no related games when there are no other games in the category', async () => {
        await seedGames(db, 1);
        const [game] = await getAllGames(db);

        expect(await getRelatedGames(db, game.category?.id ?? null, game.id)).toEqual([]);
    });

    it('returns no related games when the category id is null', async () => {
        expect(await getRelatedGames(db, null, 1)).toEqual([]);
    });
});
