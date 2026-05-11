# Security Specification for Stellar Match Multiplayer

## Data Invariants
1. A game must have exactly two player slots (player1 and player2).
2. Only the player whose turn it is can modify the `grid`, `score`, and `turn`.
3. A player can only join a game if it is in 'waiting' status and has an empty slot.
4. Timestamps must be server-generated.
5. Scores must always be non-negative.

## The Dirty Dozen Payloads
1. Attempt to set `player1.score` when it's not the user's turn.
2. Attempt to join a game that already has two players.
3. Attempt to modify the grid when the game is 'finished'.
4. Attempt to hijack `player1.uid` after it has been set.
5. Attempt to set `updatedAt` to a past date.
6. Attempt to delete a game session the user doesn't own.
7. Attempt to update a game without being one of the players.
8. Attempt to set status to 'finished' prematurely.
9. Attempt to inject a 1MB string into the game metadata.
10. Attempt to change `player2` data as `player1`.
11. Attempt to create a game with status 'playing' immediately (should be 'waiting').
12. Attempt to write to a non-existent field to bypass schema validation.

## Test Runner
(Tests will be implemented if required, but the rules will be designed to prevent these.)
