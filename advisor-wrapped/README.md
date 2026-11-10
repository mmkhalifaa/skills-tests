# Advisor Wrapped

A tap-through year-end recap for advisors, in the style of Spotify Wrapped. It replaces the year-end recap email with a small web app an advisor opens from a link.

Everything is in one self-contained file, `index.html`. There is no build step. The only outside dependency is Google Fonts.

## Run it

Open `index.html` in a browser, or serve this folder from any static host.

## What it does

Ten chapters, each on its own colour:

1. Start
2. New accounts, with a month-by-month chart
3. Trades, with a "guess first" question before the number is shown
4. Client review reports
5. Texts, with typical reply time
6. Coach questions, with the most-asked topics
7. Your rhythm, a weekday-by-hour heatmap of the busiest hour
8. Three moments from the year
9. Advisor type, based on where the advisor most outpaces the typical advisor
10. Year-end statement, a receipt-style summary

Controls:

- Tap or click the right side to move ahead, the left side to go back. Swipe and arrow keys work too.
- Hold to pause. The pause button at the top stops autoplay.
- The menu button at the top right jumps between chapters and switches between the three sample advisors.
- Each chapter has its own address, for example `index.html#trades`.

On the last chapter:

- **Save card** makes a 1080 x 1920 PNG of the statement. In a normal browser this is a download, or the share sheet on a phone.
- **Copy stats** copies the numbers as text.
- **Replay** starts again.

## Sample data

All of the numbers are invented. They live in the block marked `sample data` at the top of the script in `index.html`:

| Name | What it holds |
| --- | --- |
| `ADVISORS` | Three made-up advisors. Each has totals for accounts, trades, reviews, texts and Coach questions, plus monthly accounts, busiest days, top Coach topics, busiest hour and three "moments". |
| `TYPICAL` | The typical advisor's yearly totals. The advisor type and the comparison chart are worked out against these. |
| `TYPES` | The five advisor types and their one-line descriptions. |
| `TRADING_DAYS` | 251, the number of NYSE sessions in 2026. |
| `PAGES_PER_REPORT` | 12, used for the "pages if printed" fact. |

## Before this goes to real advisors

- Replace `ADVISORS` with one advisor's record from your own data source, and remove the sample-advisor switcher and the "Sample data" labels (one in the page header, one on the saved card).
- Replace `TYPICAL` with real firm-wide figures.
- `reviews.top` (the "top X% of advisors" line) is typed in by hand in the sample data. It needs a real percentile.
- The weekly trades chart and the heatmap are generated from the totals with a seeded random function (`weekly()` and `heat()`). Swap in real weekly and hourly series.
- Check the copy and the saved card with compliance before advisors can share them outside the firm.
