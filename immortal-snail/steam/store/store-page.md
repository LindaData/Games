# Immortal Snail Chess: Steam store page

Copy and paste into Steamworks (Store Admin). Lengths are within Steam's limits
(the short description is 275 characters).

The game in one breath: you play White against the computer. Two immortal snails are on the
board: your green snail hunts their king, their bronze snail hunts yours. Every 3 turns both
crawl one square. Snail touches king: that king loses. Three modes decide what a snail does to
the pieces in its way: Ghost (slides over), Hungry (eats enemy pieces), Sacrifice (you give up a
piece and your snail starts in its place).

## Game name

Immortal Snail Chess

## Short description (max 300 characters)

> Normal chess against a friendly computer, except two immortal snails crawl one square closer every three turns. Yours hunts their king. Theirs hunts yours. Nothing can stop them. Three ways to play: snails that slide, snails that eat, or a piece you give up for a head start.

## About This Game

> Paste into "About This Game". Steam's editor takes the BBCode below as is.

```
[h2]Chess, but with snails. Immortal ones.[/h2]
You play White against a friendly computer. Normal chess rules, normal pieces, one small problem: every three turns, two snails crawl one square closer.

[b]Your green snail[/b] crawls toward their king. [b]Their bronze snail[/b] crawls toward yours. Snails can't be captured, blocked or scared off. They just keep coming.

[list]
[*] Your snail reaches their king: [b]you win.[/b]
[*] Their snail reaches your king: [b]you lose.[/b]
[*] Checkmate still works, if you're quick about it.
[/list]

You'll get it in ten seconds. You'll still be thinking about it ten minutes later.

[h2]Three ways to play[/h2]
[list]
[*][b]Ghost Snails[/b]: the snails slide over every piece and never eat anything. A pure race.
[*][b]Hungry Snails[/b]: snails eat any enemy piece they crawl onto (your own pieces are safe from your snail). Is your bishop worth moving, or worth saving?
[*][b]Sacrifice Snails[/b]: before the first move, give up one of your pieces (anything but the king). Your snail starts in its place, and the computer gives up the same piece on its side. A rook for a head start?
[/list]

[h2]Features[/h2]
[list]
[*] Real chess: castling, en passant, promotion, stalemate and the usual draws.
[*] Two immortal snails, one for each side, that crawl every three turns.
[*] Three modes, each with its own win/loss record.
[*] A friendly computer that plays loosely and differently every game.
[*] Pick up and play: the game saves after every move and resumes where you left off.
[*] Mouse, touch or keyboard (arrow keys move around the board).
[*] Light and dark themes that follow your system.
[*] Fully offline. No account, no ads, no data collected.
[/list]
```

## Features (short list, for the capsule/bullets elsewhere)

- Normal chess plus two immortal snails: yours hunts their king, theirs hunts yours
- Three modes: Ghost Snails, Hungry Snails, Sacrifice Snails
- Learn it in 10 seconds; games take about 10 minutes
- Friendly computer opponent that plays differently every game
- Saves after every move; works fully offline

## Screenshots (upload in this order)

All 1920x1080, taken from the real game by `npm run screenshots` (in `steam/`):

1. `01-pick-a-mode.png`: the start screen with the three modes and the three rules
2. `02-ghost-snails.png`: Ghost Snails mid-game, both snails on their way, "Snails crawl after this turn"
3. `03-hungry-snail-eats.png`: Hungry Snails, your snail chomps a black pawn
4. `04-sacrifice-pick.png`: Sacrifice Snails, giving up a knight before move 1
5. `05-sacrifice-dark.png`: Sacrifice Snails mid-game, dark theme
6. `06-your-snail-wins.png`: your green snail knocks over their king, "You win!"
7. `07-their-snail-wins.png`: their bronze snail gets your king, "The snail got you!"

Lead with 02, 03 or 06 if you prefer action over the menu as the first image.

## Tags (in this order)

Chess, Board Game, Strategy, Casual, Turn-Based, Singleplayer, Funny, Relaxing, 2D, Cute

(Optional extras if Steam suggests them: Puzzle, Family Friendly, Minimalist, Short.)

## Genre

Primary: Strategy. Also: Casual, Indie.

## System requirements

| | Windows | SteamOS + Linux |
| --- | --- | --- |
| OS | Windows 10 64-bit or newer | Ubuntu 20.04+ (or equivalent) 64-bit, SteamOS 3 |
| Processor | 2 cores, 64-bit | 2 cores, 64-bit |
| Memory | 4 GB RAM | 4 GB RAM |
| Graphics | Any (no 3D acceleration or WebGL needed) | Any (no 3D acceleration or WebGL needed) |
| Storage | 400 MB available space | 400 MB available space |
| Additional notes | Plays with mouse, touch or keyboard | Plays with mouse, touch or keyboard |

Minimum and recommended are the same.

## Languages

English: interface yes, full audio no (there is no voice), subtitles not applicable.

## Content survey (Steamworks > Store Admin > Content Survey)

- Violence, gore, sexual content, nudity, mature themes: **none**. (Pieces are captured, a king
  gets knocked over by a snail. That's the most violent it gets.)
- Profanity: none.
- Gambling or real-money elements: none. In-app purchases: none.
- User-generated content: none. Online / multiplayer / chat: none.
- Personal data: the game collects nothing and never connects to the internet. Saves stay on the
  player's computer.
- AI-generated content disclosure: answer according to how the final game assets were made. Code
  and art in this repo were written with an AI coding assistant; if you keep them, disclose
  "pre-generated content" truthfully in the AI section of the survey.

## Suggested price: US$2.99

- It is a small, instantly understood novelty: a twist on a game everyone knows, played in
  10-minute sessions with three modes. That reads as an impulse buy, and $2.99 sits in the
  sweet spot for that ($1.99 signals "throwaway", $4.99+ invites comparison with full chess
  apps, many of them free).
- Steam's minimum price is $0.99; at $2.99 regional pricing (accept Steam's recommended
  regional prices) stays meaningful everywhere.
- Leave room for a 10-20% launch discount and later seasonal sales without going below $1.99.
- The $100 Steam Direct fee is paid back after $1,000 of adjusted gross revenue (about 335 copies
  at full US price).

## Release checklist

- [ ] Store page text pasted (name, short description, about, tags, genre, languages, system
      requirements)
- [ ] All graphics uploaded from `store/art/` (Store Assets + Library Assets), community and
      client icons set
- [ ] At least 5 screenshots uploaded from `store/screenshots/` (all 7, in order)
- [ ] Trailer (optional but recommended): 30-60 s of real gameplay, ending on a snail win
- [ ] Content survey answered, AI disclosure answered
- [ ] Price set (US$2.99) and regional prices accepted
- [ ] Store page submitted for review, review passed
- [ ] "Coming Soon" page public for at least 2 weeks
- [ ] Build uploaded, tested from the beta branch on Windows and Linux (and Steam Deck)
- [ ] Build set live on the default branch, build review passed
- [ ] Release date set; press Release
